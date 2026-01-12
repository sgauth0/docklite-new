package cloudflare

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
)

const baseURL = "https://api.cloudflare.com/client/v4"

type Client struct {
	apiToken string
}

type apiResponse struct {
	Success bool            `json:"success"`
	Errors  []apiError      `json:"errors"`
	Result  json.RawMessage `json:"result"`
}

type apiError struct {
	Message string `json:"message"`
}

type DNSRecord struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	Name     string `json:"name"`
	Content  string `json:"content"`
	TTL      int    `json:"ttl"`
	Proxied  bool   `json:"proxied"`
	Priority *int   `json:"priority,omitempty"`
}

func NewClient(apiToken string) *Client {
	return &Client{apiToken: apiToken}
}

func (c *Client) VerifyToken() bool {
	_, err := c.request("GET", "/user/tokens/verify", nil)
	return err == nil
}

func (c *Client) ListDNSRecords(zoneID string) ([]DNSRecord, error) {
	body, err := c.request("GET", fmt.Sprintf("/zones/%s/dns_records", zoneID), nil)
	if err != nil {
		return nil, err
	}
	var records []DNSRecord
	if err := json.Unmarshal(body, &records); err != nil {
		return nil, err
	}
	return records, nil
}

func (c *Client) CreateDNSRecord(zoneID string, record DNSRecord) (*DNSRecord, error) {
	payload := map[string]any{
		"type":    record.Type,
		"name":    record.Name,
		"content": record.Content,
		"ttl":     record.TTL,
		"proxied": record.Proxied,
	}
	if record.Priority != nil {
		payload["priority"] = *record.Priority
	}
	body, err := c.request("POST", fmt.Sprintf("/zones/%s/dns_records", zoneID), payload)
	if err != nil {
		return nil, err
	}
	var created DNSRecord
	if err := json.Unmarshal(body, &created); err != nil {
		return nil, err
	}
	return &created, nil
}

func (c *Client) request(method string, endpoint string, payload any) (json.RawMessage, error) {
	var bodyBytes []byte
	var err error
	if payload != nil {
		bodyBytes, err = json.Marshal(payload)
		if err != nil {
			return nil, err
		}
	}

	req, err := http.NewRequest(method, baseURL+endpoint, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.apiToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var response apiResponse
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, err
	}
	if resp.StatusCode/100 != 2 || !response.Success {
		message := "Cloudflare API error"
		if len(response.Errors) > 0 && response.Errors[0].Message != "" {
			message = response.Errors[0].Message
		}
		return nil, fmt.Errorf("Cloudflare API error: %s", message)
	}

	return response.Result, nil
}
