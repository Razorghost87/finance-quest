-- Create guest_session table
CREATE TABLE IF NOT EXISTS guest_session (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  upload_count INTEGER DEFAULT 0,
  used BOOLEAN DEFAULT FALSE
);

-- Create upload table
CREATE TABLE IF NOT EXISTS upload (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_token TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'error')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create statement_extract table
CREATE TABLE IF NOT EXISTS statement_extract (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id UUID REFERENCES upload(id) ON DELETE CASCADE,
  guest_token TEXT NOT NULL,
  period TEXT,
  free_summary JSONB,
  confidence_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create transaction_extract table
CREATE TABLE IF NOT EXISTS transaction_extract (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id UUID REFERENCES upload(id) ON DELETE CASCADE,
  statement_extract_id UUID REFERENCES statement_extract(id) ON DELETE CASCADE,
  guest_token TEXT NOT NULL,
  date DATE,
  merchant TEXT,
  category TEXT,
  amount DECIMAL(10, 2),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_guest_session_token ON guest_session(guest_token);
CREATE INDEX IF NOT EXISTS idx_upload_guest_token ON upload(guest_token);
CREATE INDEX IF NOT EXISTS idx_upload_status ON upload(status);
CREATE INDEX IF NOT EXISTS idx_statement_extract_upload ON statement_extract(upload_id);
CREATE INDEX IF NOT EXISTS idx_statement_extract_guest ON statement_extract(guest_token);
CREATE INDEX IF NOT EXISTS idx_transaction_extract_upload ON transaction_extract(upload_id);
CREATE INDEX IF NOT EXISTS idx_transaction_extract_guest ON transaction_extract(guest_token);

-- Enable Row Level Security
ALTER TABLE guest_session ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload ENABLE ROW LEVEL SECURITY;
ALTER TABLE statement_extract ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_extract ENABLE ROW LEVEL SECURITY;

-- RLS Policies for guest_session
-- Note: For production, implement proper token-based RLS
-- For now, allowing all access (restricted by app logic)
CREATE POLICY "Allow guest session access" ON guest_session
  FOR ALL USING (true) WITH CHECK (true);

-- RLS Policies for upload
CREATE POLICY "Allow upload access" ON upload
  FOR ALL USING (true) WITH CHECK (true);

-- RLS Policies for statement_extract
CREATE POLICY "Allow statement extract access" ON statement_extract
  FOR ALL USING (true) WITH CHECK (true);

-- RLS Policies for transaction_extract
CREATE POLICY "Allow transaction extract access" ON transaction_extract
  FOR ALL USING (true) WITH CHECK (true);

-- Function to check if guest can upload
CREATE OR REPLACE FUNCTION can_guest_upload(p_guest_token TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_session guest_session%ROWTYPE;
BEGIN
  -- Get or create session
  SELECT * INTO v_session
  FROM guest_session
  WHERE guest_token = p_guest_token;

  -- If no session exists, create one
  IF NOT FOUND THEN
    INSERT INTO guest_session (guest_token, upload_count, used)
    VALUES (p_guest_token, 0, FALSE)
    RETURNING * INTO v_session;
  END IF;

  -- Check if already used
  IF v_session.used THEN
    RETURN FALSE;
  END IF;

  -- Check upload count
  IF v_session.upload_count >= 1 THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark guest as used
CREATE OR REPLACE FUNCTION mark_guest_used(p_guest_token TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE guest_session
  SET used = TRUE, upload_count = upload_count + 1
  WHERE guest_token = p_guest_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC function to get guest free summary
CREATE OR REPLACE FUNCTION get_guest_free_summary(p_guest_token TEXT)
RETURNS JSONB AS $$
DECLARE
  v_summary JSONB;
BEGIN
  SELECT free_summary INTO v_summary
  FROM statement_extract
  WHERE guest_token = p_guest_token
  ORDER BY created_at DESC
  LIMIT 1;

  RETURN COALESCE(v_summary, '{}'::JSONB);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update updated_at on upload
CREATE OR REPLACE FUNCTION update_upload_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_upload_updated_at
  BEFORE UPDATE ON upload
  FOR EACH ROW
  EXECUTE FUNCTION update_upload_updated_at();

