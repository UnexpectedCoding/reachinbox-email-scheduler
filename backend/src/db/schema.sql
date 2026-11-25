-- ReachInbox Email Scheduler Schema for PostgreSQL

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    google_id VARCHAR(128) UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    picture TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS senders (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS emails (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64),
    sender_id VARCHAR(64) NOT NULL,
    sender_email VARCHAR(255) NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(255),
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    body_preview TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'scheduled',
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    preview_url TEXT,
    bullmq_job_id VARCHAR(128),
    delay_between_emails INTEGER DEFAULT 0,
    hourly_limit INTEGER DEFAULT 100,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_emails_status ON emails(status);
CREATE INDEX IF NOT EXISTS idx_emails_sender_email ON emails(sender_email);
CREATE INDEX IF NOT EXISTS idx_emails_scheduled_at ON emails(scheduled_at);

CREATE TABLE IF NOT EXISTS slack_integrations (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64),
    access_token TEXT,
    webhook_url TEXT,
    channel_id VARCHAR(128),
    channel_name VARCHAR(128),
    team_id VARCHAR(128),
    team_name VARCHAR(128),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hourly_rate_limits (
    id VARCHAR(64) PRIMARY KEY,
    sender_email VARCHAR(255) NOT NULL,
    hour_window VARCHAR(64) NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    limit_value INTEGER NOT NULL,
    notified_slack BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_sender_hour UNIQUE (sender_email, hour_window)
);
