package session

import (
	"crypto/rand"
	"encoding/hex"
	"sync"
	"time"
)

type Sess struct {
	Username string
	Role     string
	Expires  time.Time
}

type Store struct {
	mu   sync.RWMutex
	data map[string]Sess
}

func NewStore() *Store {
	return &Store{data: make(map[string]Sess)}
}

func (s *Store) Create(username, role string) string {
	b := make([]byte, 32)
	rand.Read(b)
	tok := hex.EncodeToString(b)
	s.mu.Lock()
	s.data[tok] = Sess{Username: username, Role: role, Expires: time.Now().Add(24 * time.Hour)}
	s.mu.Unlock()
	return tok
}

func (s *Store) Get(token string) (Sess, bool) {
	s.mu.RLock()
	v, ok := s.data[token]
	s.mu.RUnlock()
	if !ok || time.Now().After(v.Expires) {
		return Sess{}, false
	}
	return v, true
}

func (s *Store) Valid(token string) bool { _, ok := s.Get(token); return ok }

func (s *Store) Delete(token string) {
	s.mu.Lock()
	delete(s.data, token)
	s.mu.Unlock()
}
