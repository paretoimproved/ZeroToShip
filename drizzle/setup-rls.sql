-- Row Level Security (RLS) Policies for ZeroToShip
-- Run this in Supabase SQL Editor

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE viewed_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_requests ENABLE ROW LEVEL SECURITY;

-- ============================================
-- USERS TABLE
-- ============================================

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
ON users FOR SELECT
USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON users FOR UPDATE
USING (auth.uid() = id);

-- Service role can manage all users
CREATE POLICY "Service role full access to users"
ON users FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- USER PREFERENCES TABLE
-- ============================================

-- Users can read their own preferences
CREATE POLICY "Users can view own preferences"
ON user_preferences FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own preferences
CREATE POLICY "Users can create own preferences"
ON user_preferences FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own preferences
CREATE POLICY "Users can update own preferences"
ON user_preferences FOR UPDATE
USING (auth.uid() = user_id);

-- Service role can manage all preferences
CREATE POLICY "Service role full access to preferences"
ON user_preferences FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- API KEYS TABLE
-- ============================================

-- Users can view their own API keys
CREATE POLICY "Users can view own api keys"
ON api_keys FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own API keys
CREATE POLICY "Users can create own api keys"
ON api_keys FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own API keys
CREATE POLICY "Users can update own api keys"
ON api_keys FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own API keys
CREATE POLICY "Users can delete own api keys"
ON api_keys FOR DELETE
USING (auth.uid() = user_id);

-- Service role can manage all API keys
CREATE POLICY "Service role full access to api keys"
ON api_keys FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- IDEAS TABLE (Public read, service write)
-- ============================================

-- Anyone can read published ideas
CREATE POLICY "Anyone can view published ideas"
ON ideas FOR SELECT
USING (is_published = true);

-- Service role can manage all ideas
CREATE POLICY "Service role full access to ideas"
ON ideas FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- SAVED IDEAS TABLE
-- ============================================

-- Users can view their own saved ideas
CREATE POLICY "Users can view own saved ideas"
ON saved_ideas FOR SELECT
USING (auth.uid() = user_id);

-- Users can save ideas
CREATE POLICY "Users can save ideas"
ON saved_ideas FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can unsave ideas
CREATE POLICY "Users can unsave ideas"
ON saved_ideas FOR DELETE
USING (auth.uid() = user_id);

-- Service role can manage all saved ideas
CREATE POLICY "Service role full access to saved ideas"
ON saved_ideas FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- VIEWED IDEAS TABLE
-- ============================================

-- Users can view their own history
CREATE POLICY "Users can view own history"
ON viewed_ideas FOR SELECT
USING (auth.uid() = user_id);

-- Users can add to their history
CREATE POLICY "Users can add to history"
ON viewed_ideas FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Service role can manage all viewed ideas
CREATE POLICY "Service role full access to viewed ideas"
ON viewed_ideas FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- SUBSCRIPTIONS TABLE
-- ============================================

-- Users can view their own subscription
CREATE POLICY "Users can view own subscription"
ON subscriptions FOR SELECT
USING (auth.uid() = user_id);

-- Service role can manage all subscriptions (Stripe webhooks)
CREATE POLICY "Service role full access to subscriptions"
ON subscriptions FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- RATE LIMITS TABLE (Service role only)
-- ============================================

-- Service role can manage all rate limits
CREATE POLICY "Service role full access to rate limits"
ON rate_limits FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- VALIDATION REQUESTS TABLE
-- ============================================

-- Users can view their own validation requests
CREATE POLICY "Users can view own validation requests"
ON validation_requests FOR SELECT
USING (auth.uid() = user_id);

-- Users can create validation requests
CREATE POLICY "Users can create validation requests"
ON validation_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Service role can manage all validation requests
CREATE POLICY "Service role full access to validation requests"
ON validation_requests FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');
