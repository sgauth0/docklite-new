package store

import (
	"database/sql"
	"fmt"
)

type DatabaseRecord struct {
	ID           int64  `json:"id"`
	Name         string `json:"name"`
	Type         string `json:"type"`
	ContainerID  string `json:"container_id"`
	PostgresPort int    `json:"postgres_port"`
	DBPath       string `json:"db_path,omitempty"`
	CreatedAt    string `json:"created_at"`
}

func (s *SQLiteStore) GetDatabaseByID(id int64) (*DatabaseRecord, error) {
	row := s.DB.QueryRow(`
    SELECT id, name, COALESCE(type, 'postgres'), container_id, postgres_port, COALESCE(db_path, ''), created_at
    FROM databases
    WHERE id = ?
  `, id)
	var record DatabaseRecord
	if err := row.Scan(&record.ID, &record.Name, &record.Type, &record.ContainerID, &record.PostgresPort, &record.DBPath, &record.CreatedAt); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &record, nil
}

func (s *SQLiteStore) GetDatabaseByName(name string) (*DatabaseRecord, error) {
	row := s.DB.QueryRow(`
    SELECT id, name, COALESCE(type, 'postgres'), container_id, postgres_port, COALESCE(db_path, ''), created_at
    FROM databases
    WHERE name = ?
  `, name)
	var record DatabaseRecord
	if err := row.Scan(&record.ID, &record.Name, &record.Type, &record.ContainerID, &record.PostgresPort, &record.DBPath, &record.CreatedAt); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &record, nil
}

func (s *SQLiteStore) UpsertDatabase(name string, dbType string, containerID string, port int, dbPath string) (*DatabaseRecord, error) {
	if name == "" {
		return nil, fmt.Errorf("database name is required")
	}
	if dbType == "" {
		dbType = "postgres"
	}
	existing, err := s.GetDatabaseByName(name)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		if _, err := s.DB.Exec(`
      UPDATE databases
      SET type = ?, container_id = ?, postgres_port = ?, db_path = ?
      WHERE id = ?
    `, dbType, containerID, port, dbPath, existing.ID); err != nil {
			return nil, err
		}
		existing.Type = dbType
		existing.ContainerID = containerID
		existing.PostgresPort = port
		existing.DBPath = dbPath
		return existing, nil
	}

	result, err := s.DB.Exec(`
    INSERT INTO databases (name, type, container_id, postgres_port, db_path)
    VALUES (?, ?, ?, ?, ?)
  `, name, dbType, containerID, port, dbPath)
	if err != nil {
		return nil, err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}
	return s.GetDatabaseByID(id)
}

func (s *SQLiteStore) ListDatabases() ([]DatabaseRecord, error) {
	rows, err := s.DB.Query(`
    SELECT id, name, COALESCE(type, 'postgres'), container_id, postgres_port, COALESCE(db_path, ''), created_at
    FROM databases
    ORDER BY created_at DESC
  `)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []DatabaseRecord
	for rows.Next() {
		var record DatabaseRecord
		if err := rows.Scan(&record.ID, &record.Name, &record.Type, &record.ContainerID, &record.PostgresPort, &record.DBPath, &record.CreatedAt); err != nil {
			return nil, err
		}
		records = append(records, record)
	}
	return records, rows.Err()
}

func (s *SQLiteStore) ListDatabasesByUser(userID int64) ([]DatabaseRecord, error) {
	rows, err := s.DB.Query(`
    SELECT d.id, d.name, COALESCE(d.type, 'postgres'), d.container_id, d.postgres_port, COALESCE(d.db_path, ''), d.created_at
    FROM databases d
    JOIN database_permissions dp ON d.id = dp.database_id
    WHERE dp.user_id = ?
    ORDER BY d.created_at DESC
  `, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []DatabaseRecord
	for rows.Next() {
		var record DatabaseRecord
		if err := rows.Scan(&record.ID, &record.Name, &record.Type, &record.ContainerID, &record.PostgresPort, &record.DBPath, &record.CreatedAt); err != nil {
			return nil, err
		}
		records = append(records, record)
	}
	return records, rows.Err()
}

func (s *SQLiteStore) HasDatabaseAccess(userID int64, databaseID int64) (bool, error) {
	row := s.DB.QueryRow(`
    SELECT 1
    FROM database_permissions
    WHERE user_id = ? AND database_id = ?
    LIMIT 1
  `, userID, databaseID)
	var exists int
	if err := row.Scan(&exists); err != nil {
		if err == sql.ErrNoRows {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

func (s *SQLiteStore) DeleteDatabase(id int64) error {
	_, err := s.DB.Exec(`DELETE FROM databases WHERE id = ?`, id)
	return err
}

func (s *SQLiteStore) DeleteDatabasePermissionsByDatabaseID(databaseID int64) error {
	_, err := s.DB.Exec(`DELETE FROM database_permissions WHERE database_id = ?`, databaseID)
	return err
}

func (s *SQLiteStore) CleanupOrphanedDatabasePermissions() error {
	_, err := s.DB.Exec(`
    DELETE FROM database_permissions
    WHERE user_id NOT IN (SELECT id FROM users)
       OR database_id NOT IN (SELECT id FROM databases)
  `)
	return err
}

func (s *SQLiteStore) CountTables() (int, error) {
	row := s.DB.QueryRow(`
    SELECT COUNT(*)
    FROM sqlite_master
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
  `)
	var count int
	if err := row.Scan(&count); err != nil {
		return 0, err
	}
	return count, nil
}
