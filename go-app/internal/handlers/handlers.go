package handlers

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
)

const maxJSONBodyBytes = 10 << 20

func readJSON(r *http.Request, dest any) error {
	limited := &io.LimitedReader{R: r.Body, N: maxJSONBodyBytes + 1}
	decoder := json.NewDecoder(limited)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(dest); err != nil {
		if limited.N <= 0 {
			return errors.New("request body too large")
		}
		return err
	}
	if limited.N <= 0 {
		return errors.New("request body too large")
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		return errors.New("invalid request body")
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if payload != nil {
		_ = json.NewEncoder(w).Encode(payload)
	}
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}
