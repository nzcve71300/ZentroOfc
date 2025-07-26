-- Fix database permissions for sequences
-- Run this as a PostgreSQL superuser (like postgres)

-- Grant usage on sequences to the database user
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO zentro_user;

-- Grant usage on future sequences
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO zentro_user;

-- Grant all privileges on tables
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO zentro_user;

-- Grant all privileges on future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO zentro_user;

-- Grant all privileges on sequences
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO zentro_user;

-- Grant all privileges on future sequences
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO zentro_user;

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO zentro_user;

-- Grant create privileges
GRANT CREATE ON SCHEMA public TO zentro_user; 