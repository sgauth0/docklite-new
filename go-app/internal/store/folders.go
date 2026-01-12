package store

import (
	"database/sql"
	"errors"
)

type Folder struct {
	ID             int64  `json:"id"`
	UserID         int64  `json:"user_id"`
	Name           string `json:"name"`
	ParentFolderID *int64 `json:"parent_folder_id"`
	Depth          int    `json:"depth"`
	Position       int    `json:"position"`
	CreatedAt      string `json:"created_at"`
}

func (s *SQLiteStore) GetFoldersByUser(userID int64) ([]Folder, error) {
	rows, err := s.DB.Query(`
    SELECT id, user_id, name, parent_folder_id, depth, position, created_at
    FROM folders
    WHERE user_id = ?
    ORDER BY parent_folder_id IS NOT NULL, parent_folder_id, position ASC
  `, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []Folder
	for rows.Next() {
		folder, err := scanFolder(rows)
		if err != nil {
			return nil, err
		}
		results = append(results, *folder)
	}
	return results, rows.Err()
}

func (s *SQLiteStore) GetFolderByID(id int64) (*Folder, error) {
	row := s.DB.QueryRow(`
    SELECT id, user_id, name, parent_folder_id, depth, position, created_at
    FROM folders
    WHERE id = ?
  `, id)
	return scanFolder(row)
}

func (s *SQLiteStore) CreateFolder(userID int64, name string, parentFolderID *int64) (*Folder, error) {
	depth := 0
	if parentFolderID != nil {
		parent, err := s.GetFolderByID(*parentFolderID)
		if err != nil {
			return nil, err
		}
		if parent == nil {
			return nil, errors.New("parent folder not found")
		}
		depth = parent.Depth + 1
	}

	position, err := s.nextFolderPosition(userID, parentFolderID)
	if err != nil {
		return nil, err
	}

	result, err := s.DB.Exec(`
    INSERT INTO folders (user_id, name, parent_folder_id, depth, position)
    VALUES (?, ?, ?, ?, ?)
  `, userID, name, parentFolderID, depth, position)
	if err != nil {
		return nil, err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}
	return s.GetFolderByID(id)
}

func (s *SQLiteStore) DeleteFolder(id int64) error {
	_, err := s.DB.Exec(`DELETE FROM folders WHERE id = ?`, id)
	return err
}

func (s *SQLiteStore) MoveFolderToParent(folderID int64, newParentID *int64) error {
	folder, err := s.GetFolderByID(folderID)
	if err != nil {
		return err
	}
	if folder == nil {
		return errors.New("folder not found")
	}

	newDepth := 0
	if newParentID != nil {
		parent, err := s.GetFolderByID(*newParentID)
		if err != nil {
			return err
		}
		if parent == nil {
			return errors.New("parent folder not found")
		}
		newDepth = parent.Depth + 1
	}

	newPosition, err := s.nextFolderPosition(folder.UserID, newParentID)
	if err != nil {
		return err
	}

	tx, err := s.DB.Begin()
	if err != nil {
		return err
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	_, err = tx.Exec(`
    UPDATE folders
    SET parent_folder_id = ?, depth = ?, position = ?
    WHERE id = ?
  `, newParentID, newDepth, newPosition, folderID)
	if err != nil {
		return err
	}

	if err = updateDescendantDepths(tx, folderID, newDepth); err != nil {
		return err
	}

	if folder.ParentFolderID != nil {
		_, err = tx.Exec(`
      UPDATE folders
      SET position = position - 1
      WHERE user_id = ? AND parent_folder_id = ? AND position > ?
    `, folder.UserID, folder.ParentFolderID, folder.Position)
	} else {
		_, err = tx.Exec(`
      UPDATE folders
      SET position = position - 1
      WHERE user_id = ? AND parent_folder_id IS NULL AND position > ?
    `, folder.UserID, folder.Position)
	}
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (s *SQLiteStore) GetContainersByFolder(folderID int64) ([]string, error) {
	rows, err := s.DB.Query(`
    SELECT container_id
    FROM folder_containers
    WHERE folder_id = ?
    ORDER BY position ASC
  `, folderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []string
	for rows.Next() {
		var containerID string
		if err := rows.Scan(&containerID); err != nil {
			return nil, err
		}
		results = append(results, containerID)
	}
	return results, rows.Err()
}

func (s *SQLiteStore) MoveContainerToFolder(containerID string, targetFolderID int64) error {
	tx, err := s.DB.Begin()
	if err != nil {
		return err
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	var sourceFolderID sql.NullInt64
	var sourcePosition sql.NullInt64
	row := tx.QueryRow(`SELECT folder_id, position FROM folder_containers WHERE container_id = ?`, containerID)
	if scanErr := row.Scan(&sourceFolderID, &sourcePosition); scanErr != nil && scanErr != sql.ErrNoRows {
		return scanErr
	}

	if _, err = tx.Exec(`DELETE FROM folder_containers WHERE container_id = ?`, containerID); err != nil {
		return err
	}

	if sourceFolderID.Valid {
		if _, err = tx.Exec(`
      UPDATE folder_containers
      SET position = position - 1
      WHERE folder_id = ? AND position > ?
    `, sourceFolderID.Int64, sourcePosition.Int64); err != nil {
			return err
		}
	}

	position, err := nextContainerPosition(tx, targetFolderID)
	if err != nil {
		return err
	}

	if _, err = tx.Exec(`
    INSERT OR IGNORE INTO folder_containers (folder_id, container_id, position)
    VALUES (?, ?, ?)
  `, targetFolderID, containerID, position); err != nil {
		return err
	}

	return tx.Commit()
}

func (s *SQLiteStore) UnlinkContainerFromFolder(folderID int64, containerID string) error {
	_, err := s.DB.Exec(`
    DELETE FROM folder_containers WHERE folder_id = ? AND container_id = ?
  `, folderID, containerID)
	return err
}

func (s *SQLiteStore) ReorderContainerInFolder(folderID int64, containerID string, newPosition int) error {
	tx, err := s.DB.Begin()
	if err != nil {
		return err
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	var oldPosition int
	row := tx.QueryRow(`
    SELECT position
    FROM folder_containers
    WHERE folder_id = ? AND container_id = ?
  `, folderID, containerID)
	if err = row.Scan(&oldPosition); err != nil {
		if err == sql.ErrNoRows {
			return errors.New("container not found in folder")
		}
		return err
	}

	var count int
	row = tx.QueryRow(`SELECT COUNT(*) as count FROM folder_containers WHERE folder_id = ?`, folderID)
	if err = row.Scan(&count); err != nil {
		return err
	}
	if count == 0 {
		return nil
	}
	if newPosition < 0 {
		newPosition = 0
	}
	if newPosition >= count {
		newPosition = count - 1
	}

	if oldPosition < newPosition {
		_, err = tx.Exec(`
      UPDATE folder_containers
      SET position = position - 1
      WHERE folder_id = ? AND position > ? AND position <= ?
    `, folderID, oldPosition, newPosition)
	} else if oldPosition > newPosition {
		_, err = tx.Exec(`
      UPDATE folder_containers
      SET position = position + 1
      WHERE folder_id = ? AND position >= ? AND position < ?
    `, folderID, newPosition, oldPosition)
	}
	if err != nil {
		return err
	}

	_, err = tx.Exec(`
    UPDATE folder_containers
    SET position = ?
    WHERE folder_id = ? AND container_id = ?
  `, newPosition, folderID, containerID)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (s *SQLiteStore) MarkContainerUntracked(containerID string) error {
	_, err := s.DB.Exec(`
    INSERT OR IGNORE INTO untracked_containers (container_id)
    VALUES (?)
  `, containerID)
	return err
}

func (s *SQLiteStore) MarkContainerTracked(containerID string) error {
	_, err := s.DB.Exec(`DELETE FROM untracked_containers WHERE container_id = ?`, containerID)
	return err
}

func (s *SQLiteStore) GetUntrackedContainerIDs() ([]string, error) {
	rows, err := s.DB.Query(`SELECT container_id FROM untracked_containers`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []string
	for rows.Next() {
		var containerID string
		if err := rows.Scan(&containerID); err != nil {
			return nil, err
		}
		results = append(results, containerID)
	}
	return results, rows.Err()
}

func (s *SQLiteStore) UnlinkContainerFromAllFolders(containerID string) error {
	_, err := s.DB.Exec(`DELETE FROM folder_containers WHERE container_id = ?`, containerID)
	return err
}

func (s *SQLiteStore) GetSiteByContainerID(containerID string) (bool, error) {
	row := s.DB.QueryRow(`SELECT id FROM sites WHERE container_id = ?`, containerID)
	var id int64
	if err := row.Scan(&id); err != nil {
		if err == sql.ErrNoRows {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

func (s *SQLiteStore) UpdateSiteUserIDByContainerID(containerID string, userID int64) error {
	_, err := s.DB.Exec(`UPDATE sites SET user_id = ? WHERE container_id = ?`, userID, containerID)
	return err
}

func (s *SQLiteStore) GetUserByID(userID int64) (bool, error) {
	row := s.DB.QueryRow(`SELECT id FROM users WHERE id = ?`, userID)
	var id int64
	if err := row.Scan(&id); err != nil {
		if err == sql.ErrNoRows {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

func (s *SQLiteStore) GetDefaultFolderByUser(userID int64) (*Folder, error) {
	row := s.DB.QueryRow(`
    SELECT id, user_id, name, parent_folder_id, depth, position, created_at
    FROM folders
    WHERE user_id = ? AND name = 'Default'
    LIMIT 1
  `, userID)
	return scanFolder(row)
}

func (s *SQLiteStore) nextFolderPosition(userID int64, parentFolderID *int64) (int, error) {
	query := `SELECT COALESCE(MAX(position), -1) as max_pos FROM folders WHERE user_id = ? AND parent_folder_id IS NULL`
	args := []any{userID}
	if parentFolderID != nil {
		query = `SELECT COALESCE(MAX(position), -1) as max_pos FROM folders WHERE user_id = ? AND parent_folder_id = ?`
		args = append(args, *parentFolderID)
	}
	row := s.DB.QueryRow(query, args...)
	var maxPos int
	if err := row.Scan(&maxPos); err != nil {
		return 0, err
	}
	return maxPos + 1, nil
}

func nextContainerPosition(tx *sql.Tx, folderID int64) (int, error) {
	row := tx.QueryRow(`SELECT COALESCE(MAX(position), -1) as max_pos FROM folder_containers WHERE folder_id = ?`, folderID)
	var maxPos int
	if err := row.Scan(&maxPos); err != nil {
		return 0, err
	}
	return maxPos + 1, nil
}

func updateDescendantDepths(tx *sql.Tx, folderID int64, newDepth int) error {
	rows, err := tx.Query(`SELECT id FROM folders WHERE parent_folder_id = ?`, folderID)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var childID int64
		if err := rows.Scan(&childID); err != nil {
			return err
		}
		childDepth := newDepth + 1
		if _, err := tx.Exec(`UPDATE folders SET depth = ? WHERE id = ?`, childDepth, childID); err != nil {
			return err
		}
		if err := updateDescendantDepths(tx, childID, childDepth); err != nil {
			return err
		}
	}
	return rows.Err()
}

func scanFolder(scanner interface {
	Scan(dest ...any) error
}) (*Folder, error) {
	var folder Folder
	var parent sql.NullInt64
	if err := scanner.Scan(&folder.ID, &folder.UserID, &folder.Name, &parent, &folder.Depth, &folder.Position, &folder.CreatedAt); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	if parent.Valid {
		folder.ParentFolderID = &parent.Int64
	}
	return &folder, nil
}
