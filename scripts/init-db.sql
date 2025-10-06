-- Create test table for storing article metadata
-- This version uses quoted camelCase identifiers to match the existing schema in your Supabase
CREATE TABLE IF NOT EXISTS test (
  id BIGSERIAL PRIMARY KEY,
  "title" TEXT,
  "author" TEXT,
  "datePublished" TIMESTAMP,
  "region" TEXT,
  "topic" TEXT,
  "filePath" TEXT UNIQUE
);

-- Create indexes for better query performance (use quoted names for camelCase columns)
CREATE INDEX IF NOT EXISTS idx_test_datePublished ON test("datePublished" DESC);
CREATE INDEX IF NOT EXISTS idx_test_region ON test("region");
CREATE INDEX IF NOT EXISTS idx_test_topic ON test("topic");
CREATE INDEX IF NOT EXISTS idx_test_filePath ON test("filePath");

-- Add comments for documentation
COMMENT ON TABLE test IS 'Test table for storing article metadata with PDF file references';
COMMENT ON COLUMN test.id IS 'Auto-incrementing unique article ID';
COMMENT ON COLUMN test."title" IS 'Article title';
COMMENT ON COLUMN test."author" IS 'Article author';
COMMENT ON COLUMN test."datePublished" IS 'Article publication date';
COMMENT ON COLUMN test."region" IS 'Region/language code (e.g., us, uk)';
COMMENT ON COLUMN test."topic" IS 'Article topic/category (e.g., business, tech)';
COMMENT ON COLUMN test."filePath" IS 'PDF file URL in Supabase Storage';
