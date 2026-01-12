package store

import "database/sql"

type DatabaseRecord struct {
	ID           int64  `json:"id"`
	Name         string `json:"name"`
	ContainerID  string `json:"container_id"`
	PostgresPort int    `json:"postgres_port"`
	CreatedAt    string `json:"created_at"`
}

func (s *SQLiteStore) GetDatabaseByID(id int64) (*DatabaseRecord, error) {
	row := s.DB.QueryRow(`
    SELECT id, name, container_id, postgres_port, created_at
    FROM databases
    WHERE id = ?
  `, id)
	var record DatabaseRecord
	if err := row.Scan(&record.ID, &record.Name, &record.ContainerID, &record.PostgresPort, &record.CreatedAt); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &record, nil
}

func (s *SQLiteStore) ListDatabases() ([]DatabaseRecord, error) {
	rows, err := s.DB.Query(`
    SELECT id, name, container_id, postgres_port, created_at
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
		if err := rows.Scan(&record.ID, &record.Name, &record.ContainerID, &record.PostgresPort, &record.CreatedAt); err != nil {
			return nil, err
		}
		records = append(records, record)
	}
	return records, rows.Err()
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
