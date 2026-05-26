-- Trigger function reused by both tables
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- trips table
CREATE TABLE trips (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title               TEXT,
  start_date          DATE        NOT NULL,
  accommodation_type  TEXT        NOT NULL CHECK (accommodation_type IN ('hotel', 'tent', 'hammock', 'bivy', 'hostel')),
  riding_philosophy   TEXT        NOT NULL CHECK (riding_philosophy IN ('fast_and_light', 'expedition')),
  region              TEXT        NOT NULL,
  trip_duration_days  INTEGER     NOT NULL CHECK (trip_duration_days > 0),
  flew_by_plane       BOOLEAN     NOT NULL DEFAULT false,
  pre_trip_rating     INTEGER     CHECK (pre_trip_rating BETWEEN 1 AND 6),
  post_trip_rating    INTEGER     CHECK (post_trip_rating BETWEEN 1 AND 6),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- checklist_items table
CREATE TABLE checklist_items (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id    UUID        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  category   TEXT        NOT NULL,
  source     TEXT        NOT NULL CHECK (source IN ('ai', 'user', 'rule')),
  is_packed  BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- updated_at triggers
CREATE TRIGGER trips_updated_at
  BEFORE UPDATE ON trips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER checklist_items_updated_at
  BEFORE UPDATE ON checklist_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS on trips
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_trips" ON trips FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "users_insert_own_trips" ON trips FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "users_update_own_trips" ON trips FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "users_delete_own_trips" ON trips FOR DELETE USING (user_id = auth.uid());

-- RLS on checklist_items (via JOIN — no denormalized user_id)
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_items" ON checklist_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_id AND trips.user_id = auth.uid()));

CREATE POLICY "users_insert_own_items" ON checklist_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_id AND trips.user_id = auth.uid()));

CREATE POLICY "users_update_own_items" ON checklist_items FOR UPDATE
  USING  (EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_id AND trips.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_id AND trips.user_id = auth.uid()));

CREATE POLICY "users_delete_own_items" ON checklist_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_id AND trips.user_id = auth.uid()));
