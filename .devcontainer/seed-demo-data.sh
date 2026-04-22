#!/usr/bin/env bash
# Seed the Ghostfolio DB with a demo user and portfolio data.
# Idempotent: uses ON CONFLICT DO NOTHING throughout.
# Requires: Postgres container (gf-postgres-dev) running and schema pushed.
set -euo pipefail

PSQL="docker exec -i gf-postgres-dev psql -U user -d ghostfolio-db"

USER_ID="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
# Pre-computed: HMAC-SHA512(salt="demo0seed1", data=userId) then hashed again
# with ACCESS_TOKEN_SALT. The plaintext token the user logs in with:
PLAINTEXT_TOKEN="641d58aac7edc7ad86800fa64dcbb549c107b667e674b3e671ddb1199fb05aa3123b231ac9b9c952ebd2dcf8b8c34f88e7eac38745f77017e4190855eb435263"
HASHED_TOKEN="5dfbe0d6465695b8209f75fcbe5155feda4e9cbe9c623883e973d825803720cc44a1c080de3cdd955990be4cca0961993a9d87493a56162aff5d8900bb1ecfa9"

echo "==> Seeding demo user and portfolio data"

$PSQL <<SQL
-- Demo user (ADMIN role)
INSERT INTO "User" (id, role, "accessToken", "createdAt", "updatedAt")
VALUES ('${USER_ID}', 'ADMIN', '${HASHED_TOKEN}', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Platforms
INSERT INTO "Platform" (id, name, url) VALUES
  ('plt-ibkr',     'Interactive Brokers', 'https://www.interactivebrokers.com'),
  ('plt-schwab',   'Charles Schwab',      'https://www.schwab.com'),
  ('plt-coinbase', 'Coinbase',            'https://www.coinbase.com')
ON CONFLICT DO NOTHING;

-- Accounts
INSERT INTO "Account" (id, name, currency, balance, "isExcluded", "platformId", "userId", "createdAt", "updatedAt") VALUES
  ('acc-ibkr',     'IBKR Brokerage', 'USD', 5240.00, false, 'plt-ibkr',     '${USER_ID}', NOW(), NOW()),
  ('acc-schwab',   'Schwab IRA',     'USD', 3100.00, false, 'plt-schwab',   '${USER_ID}', NOW(), NOW()),
  ('acc-coinbase', 'Coinbase',       'USD', 1200.00, false, 'plt-coinbase', '${USER_ID}', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Symbol Profiles (MANUAL data source — no external API keys needed)
INSERT INTO "SymbolProfile" (id, symbol, "dataSource", currency, name, "assetClass", "assetSubClass", "isActive", "createdAt", "updatedAt") VALUES
  ('sp-aapl', 'AAPL', 'MANUAL', 'USD', 'Apple Inc.',                     'EQUITY',                  'STOCK',          true, NOW(), NOW()),
  ('sp-msft', 'MSFT', 'MANUAL', 'USD', 'Microsoft Corp.',                'EQUITY',                  'STOCK',          true, NOW(), NOW()),
  ('sp-blk',  'BLK',  'MANUAL', 'USD', 'BlackRock Inc.',                 'EQUITY',                  'STOCK',          true, NOW(), NOW()),
  ('sp-voo',  'VOO',  'MANUAL', 'USD', 'Vanguard S&P 500 ETF',          'EQUITY',                  'ETF',            true, NOW(), NOW()),
  ('sp-bnd',  'BND',  'MANUAL', 'USD', 'Vanguard Total Bond Market ETF', 'FIXED_INCOME',            'ETF',            true, NOW(), NOW()),
  ('sp-btc',  'BTC',  'MANUAL', 'USD', 'Bitcoin',                        'ALTERNATIVE_INVESTMENT',  'CRYPTOCURRENCY', true, NOW(), NOW()),
  ('sp-gld',  'GLD',  'MANUAL', 'USD', 'SPDR Gold Shares',              'COMMODITY',               'ETF',            true, NOW(), NOW())
ON CONFLICT DO NOTHING;

----------------------------------------------------------------------
-- Market Data (monthly + weekly for BLK)
----------------------------------------------------------------------

INSERT INTO "MarketData" (id, "dataSource", symbol, date, "marketPrice", state) VALUES
  -- AAPL
  ('md-aapl-01','MANUAL','AAPL','2025-05-01',173.50,'CLOSE'),
  ('md-aapl-02','MANUAL','AAPL','2025-06-01',178.20,'CLOSE'),
  ('md-aapl-03','MANUAL','AAPL','2025-07-01',185.40,'CLOSE'),
  ('md-aapl-04','MANUAL','AAPL','2025-08-01',181.00,'CLOSE'),
  ('md-aapl-05','MANUAL','AAPL','2025-09-01',190.30,'CLOSE'),
  ('md-aapl-06','MANUAL','AAPL','2025-10-01',195.10,'CLOSE'),
  ('md-aapl-07','MANUAL','AAPL','2025-11-01',192.80,'CLOSE'),
  ('md-aapl-08','MANUAL','AAPL','2025-12-01',198.50,'CLOSE'),
  ('md-aapl-09','MANUAL','AAPL','2026-01-01',202.30,'CLOSE'),
  ('md-aapl-10','MANUAL','AAPL','2026-02-01',208.70,'CLOSE'),
  ('md-aapl-11','MANUAL','AAPL','2026-03-01',215.40,'CLOSE'),
  ('md-aapl-12','MANUAL','AAPL','2026-04-01',211.90,'CLOSE'),
  ('md-aapl-13','MANUAL','AAPL','2026-04-22',213.50,'CLOSE'),
  -- MSFT
  ('md-msft-01','MANUAL','MSFT','2025-05-01',328.00,'CLOSE'),
  ('md-msft-02','MANUAL','MSFT','2025-06-01',335.50,'CLOSE'),
  ('md-msft-03','MANUAL','MSFT','2025-07-01',342.10,'CLOSE'),
  ('md-msft-04','MANUAL','MSFT','2025-08-01',338.20,'CLOSE'),
  ('md-msft-05','MANUAL','MSFT','2025-09-01',350.80,'CLOSE'),
  ('md-msft-06','MANUAL','MSFT','2025-10-01',358.40,'CLOSE'),
  ('md-msft-07','MANUAL','MSFT','2025-11-01',362.90,'CLOSE'),
  ('md-msft-08','MANUAL','MSFT','2025-12-01',370.20,'CLOSE'),
  ('md-msft-09','MANUAL','MSFT','2026-01-01',378.50,'CLOSE'),
  ('md-msft-10','MANUAL','MSFT','2026-02-01',385.10,'CLOSE'),
  ('md-msft-11','MANUAL','MSFT','2026-03-01',392.70,'CLOSE'),
  ('md-msft-12','MANUAL','MSFT','2026-04-01',388.30,'CLOSE'),
  ('md-msft-13','MANUAL','MSFT','2026-04-22',390.80,'CLOSE'),
  -- VOO
  ('md-voo-01','MANUAL','VOO','2025-05-01',420.30,'CLOSE'),
  ('md-voo-02','MANUAL','VOO','2025-06-01',428.10,'CLOSE'),
  ('md-voo-03','MANUAL','VOO','2025-07-01',435.50,'CLOSE'),
  ('md-voo-04','MANUAL','VOO','2025-08-01',430.20,'CLOSE'),
  ('md-voo-05','MANUAL','VOO','2025-09-01',442.80,'CLOSE'),
  ('md-voo-06','MANUAL','VOO','2025-10-01',450.10,'CLOSE'),
  ('md-voo-07','MANUAL','VOO','2025-11-01',455.30,'CLOSE'),
  ('md-voo-08','MANUAL','VOO','2025-12-01',462.70,'CLOSE'),
  ('md-voo-09','MANUAL','VOO','2026-01-01',470.50,'CLOSE'),
  ('md-voo-10','MANUAL','VOO','2026-02-01',478.20,'CLOSE'),
  ('md-voo-11','MANUAL','VOO','2026-03-01',485.90,'CLOSE'),
  ('md-voo-12','MANUAL','VOO','2026-04-01',480.40,'CLOSE'),
  ('md-voo-13','MANUAL','VOO','2026-04-22',483.10,'CLOSE'),
  -- BND
  ('md-bnd-01','MANUAL','BND','2025-05-01',72.80,'CLOSE'),
  ('md-bnd-02','MANUAL','BND','2025-06-01',73.10,'CLOSE'),
  ('md-bnd-03','MANUAL','BND','2025-07-01',73.40,'CLOSE'),
  ('md-bnd-04','MANUAL','BND','2025-08-01',73.20,'CLOSE'),
  ('md-bnd-05','MANUAL','BND','2025-09-01',73.60,'CLOSE'),
  ('md-bnd-06','MANUAL','BND','2025-10-01',73.90,'CLOSE'),
  ('md-bnd-07','MANUAL','BND','2025-11-01',74.10,'CLOSE'),
  ('md-bnd-08','MANUAL','BND','2025-12-01',74.30,'CLOSE'),
  ('md-bnd-09','MANUAL','BND','2026-01-01',74.50,'CLOSE'),
  ('md-bnd-10','MANUAL','BND','2026-02-01',74.80,'CLOSE'),
  ('md-bnd-11','MANUAL','BND','2026-03-01',75.10,'CLOSE'),
  ('md-bnd-12','MANUAL','BND','2026-04-01',74.90,'CLOSE'),
  ('md-bnd-13','MANUAL','BND','2026-04-22',75.00,'CLOSE'),
  -- BTC
  ('md-btc-01','MANUAL','BTC','2025-05-01',62500.00,'CLOSE'),
  ('md-btc-02','MANUAL','BTC','2025-06-01',65800.00,'CLOSE'),
  ('md-btc-03','MANUAL','BTC','2025-07-01',58200.00,'CLOSE'),
  ('md-btc-04','MANUAL','BTC','2025-08-01',61400.00,'CLOSE'),
  ('md-btc-05','MANUAL','BTC','2025-09-01',67300.00,'CLOSE'),
  ('md-btc-06','MANUAL','BTC','2025-10-01',72100.00,'CLOSE'),
  ('md-btc-07','MANUAL','BTC','2025-11-01',69500.00,'CLOSE'),
  ('md-btc-08','MANUAL','BTC','2025-12-01',75800.00,'CLOSE'),
  ('md-btc-09','MANUAL','BTC','2026-01-01',80200.00,'CLOSE'),
  ('md-btc-10','MANUAL','BTC','2026-02-01',78500.00,'CLOSE'),
  ('md-btc-11','MANUAL','BTC','2026-03-01',84300.00,'CLOSE'),
  ('md-btc-12','MANUAL','BTC','2026-04-01',82100.00,'CLOSE'),
  ('md-btc-13','MANUAL','BTC','2026-04-22',87500.00,'CLOSE'),
  -- GLD
  ('md-gld-01','MANUAL','GLD','2025-05-01',188.50,'CLOSE'),
  ('md-gld-02','MANUAL','GLD','2025-06-01',191.20,'CLOSE'),
  ('md-gld-03','MANUAL','GLD','2025-07-01',194.80,'CLOSE'),
  ('md-gld-04','MANUAL','GLD','2025-08-01',193.10,'CLOSE'),
  ('md-gld-05','MANUAL','GLD','2025-09-01',196.40,'CLOSE'),
  ('md-gld-06','MANUAL','GLD','2025-10-01',199.70,'CLOSE'),
  ('md-gld-07','MANUAL','GLD','2025-11-01',202.30,'CLOSE'),
  ('md-gld-08','MANUAL','GLD','2025-12-01',205.10,'CLOSE'),
  ('md-gld-09','MANUAL','GLD','2026-01-01',208.40,'CLOSE'),
  ('md-gld-10','MANUAL','GLD','2026-02-01',211.80,'CLOSE'),
  ('md-gld-11','MANUAL','GLD','2026-03-01',215.20,'CLOSE'),
  ('md-gld-12','MANUAL','GLD','2026-04-01',213.50,'CLOSE'),
  ('md-gld-13','MANUAL','GLD','2026-04-22',216.90,'CLOSE'),
  -- BLK (monthly)
  ('md-blk-01','MANUAL','BLK','2025-05-01',812.30,'CLOSE'),
  ('md-blk-02','MANUAL','BLK','2025-06-01',825.10,'CLOSE'),
  ('md-blk-03','MANUAL','BLK','2025-07-01',840.50,'CLOSE'),
  ('md-blk-04','MANUAL','BLK','2025-08-01',835.20,'CLOSE'),
  ('md-blk-05','MANUAL','BLK','2025-09-01',858.70,'CLOSE'),
  ('md-blk-06','MANUAL','BLK','2025-10-01',872.40,'CLOSE'),
  ('md-blk-07','MANUAL','BLK','2025-11-01',885.90,'CLOSE'),
  ('md-blk-08','MANUAL','BLK','2025-12-01',901.30,'CLOSE'),
  ('md-blk-09','MANUAL','BLK','2026-01-01',920.50,'CLOSE'),
  ('md-blk-10','MANUAL','BLK','2026-02-01',935.80,'CLOSE'),
  ('md-blk-11','MANUAL','BLK','2026-03-01',948.20,'CLOSE'),
  ('md-blk-12','MANUAL','BLK','2026-04-01',940.60,'CLOSE'),
  ('md-blk-13','MANUAL','BLK','2026-04-22',952.10,'CLOSE'),
  -- BLK (weekly for denser chart)
  ('md-blk-w01','MANUAL','BLK','2025-05-08',816.40,'CLOSE'),
  ('md-blk-w02','MANUAL','BLK','2025-05-15',819.70,'CLOSE'),
  ('md-blk-w03','MANUAL','BLK','2025-05-22',821.50,'CLOSE'),
  ('md-blk-w04','MANUAL','BLK','2025-06-08',827.30,'CLOSE'),
  ('md-blk-w05','MANUAL','BLK','2025-06-15',830.60,'CLOSE'),
  ('md-blk-w06','MANUAL','BLK','2025-06-22',833.80,'CLOSE'),
  ('md-blk-w07','MANUAL','BLK','2025-07-08',842.10,'CLOSE'),
  ('md-blk-w08','MANUAL','BLK','2025-07-15',838.90,'CLOSE'),
  ('md-blk-w09','MANUAL','BLK','2025-07-22',836.40,'CLOSE'),
  ('md-blk-w10','MANUAL','BLK','2025-08-08',837.80,'CLOSE'),
  ('md-blk-w11','MANUAL','BLK','2025-08-15',840.20,'CLOSE'),
  ('md-blk-w12','MANUAL','BLK','2025-08-22',845.60,'CLOSE'),
  ('md-blk-w13','MANUAL','BLK','2025-09-08',862.30,'CLOSE'),
  ('md-blk-w14','MANUAL','BLK','2025-09-15',865.10,'CLOSE'),
  ('md-blk-w15','MANUAL','BLK','2025-09-22',868.50,'CLOSE'),
  ('md-blk-w16','MANUAL','BLK','2025-10-08',875.20,'CLOSE'),
  ('md-blk-w17','MANUAL','BLK','2025-10-15',878.60,'CLOSE'),
  ('md-blk-w18','MANUAL','BLK','2025-10-22',881.30,'CLOSE'),
  ('md-blk-w19','MANUAL','BLK','2025-11-08',888.40,'CLOSE'),
  ('md-blk-w20','MANUAL','BLK','2025-11-15',892.70,'CLOSE'),
  ('md-blk-w21','MANUAL','BLK','2025-11-22',896.10,'CLOSE'),
  ('md-blk-w22','MANUAL','BLK','2025-12-08',905.80,'CLOSE'),
  ('md-blk-w23','MANUAL','BLK','2025-12-15',910.40,'CLOSE'),
  ('md-blk-w24','MANUAL','BLK','2025-12-22',914.90,'CLOSE'),
  ('md-blk-w25','MANUAL','BLK','2026-01-08',922.30,'CLOSE'),
  ('md-blk-w26','MANUAL','BLK','2026-01-15',926.80,'CLOSE'),
  ('md-blk-w27','MANUAL','BLK','2026-01-22',930.10,'CLOSE'),
  ('md-blk-w28','MANUAL','BLK','2026-02-08',938.40,'CLOSE'),
  ('md-blk-w29','MANUAL','BLK','2026-02-15',941.20,'CLOSE'),
  ('md-blk-w30','MANUAL','BLK','2026-02-22',943.70,'CLOSE'),
  ('md-blk-w31','MANUAL','BLK','2026-03-08',950.10,'CLOSE'),
  ('md-blk-w32','MANUAL','BLK','2026-03-15',946.80,'CLOSE'),
  ('md-blk-w33','MANUAL','BLK','2026-03-22',943.50,'CLOSE'),
  ('md-blk-w34','MANUAL','BLK','2026-04-08',944.20,'CLOSE'),
  ('md-blk-w35','MANUAL','BLK','2026-04-15',948.70,'CLOSE')
ON CONFLICT DO NOTHING;

----------------------------------------------------------------------
-- Orders (activities)
----------------------------------------------------------------------

INSERT INTO "Order" (id, "accountId", "accountUserId", currency, date, fee, quantity, "symbolProfileId", type, "unitPrice", "userId", "isDraft", "createdAt", "updatedAt") VALUES
  -- AAPL
  ('ord-01','acc-ibkr','${USER_ID}','USD','2025-05-15',1.00,25,'sp-aapl','BUY',175.20,'${USER_ID}',false,NOW(),NOW()),
  ('ord-02','acc-ibkr','${USER_ID}','USD','2025-09-10',1.00,15,'sp-aapl','BUY',189.50,'${USER_ID}',false,NOW(),NOW()),
  ('ord-13','acc-ibkr','${USER_ID}','USD','2025-11-14',0.00,40,'sp-aapl','DIVIDEND',0.25,'${USER_ID}',false,NOW(),NOW()),
  ('ord-14','acc-ibkr','${USER_ID}','USD','2026-03-20',1.00,10,'sp-aapl','SELL',214.80,'${USER_ID}',false,NOW(),NOW()),
  -- MSFT
  ('ord-03','acc-ibkr','${USER_ID}','USD','2025-06-20',1.00,10,'sp-msft','BUY',334.80,'${USER_ID}',false,NOW(),NOW()),
  ('ord-04','acc-ibkr','${USER_ID}','USD','2026-01-15',1.00,8,'sp-msft','BUY',376.40,'${USER_ID}',false,NOW(),NOW()),
  -- VOO
  ('ord-05','acc-schwab','${USER_ID}','USD','2025-05-05',0.00,20,'sp-voo','BUY',422.10,'${USER_ID}',false,NOW(),NOW()),
  ('ord-06','acc-schwab','${USER_ID}','USD','2025-08-12',0.00,10,'sp-voo','BUY',432.50,'${USER_ID}',false,NOW(),NOW()),
  ('ord-07','acc-schwab','${USER_ID}','USD','2025-11-20',0.00,10,'sp-voo','BUY',454.80,'${USER_ID}',false,NOW(),NOW()),
  -- BND
  ('ord-08','acc-schwab','${USER_ID}','USD','2025-07-01',0.00,50,'sp-bnd','BUY',73.30,'${USER_ID}',false,NOW(),NOW()),
  ('ord-09','acc-schwab','${USER_ID}','USD','2026-02-10',0.00,40,'sp-bnd','BUY',74.70,'${USER_ID}',false,NOW(),NOW()),
  -- BTC
  ('ord-10','acc-coinbase','${USER_ID}','USD','2025-06-01',15.00,0.15,'sp-btc','BUY',65800.00,'${USER_ID}',false,NOW(),NOW()),
  ('ord-11','acc-coinbase','${USER_ID}','USD','2025-10-15',12.00,0.10,'sp-btc','BUY',71500.00,'${USER_ID}',false,NOW(),NOW()),
  -- GLD
  ('ord-12','acc-ibkr','${USER_ID}','USD','2025-08-01',1.00,30,'sp-gld','BUY',193.10,'${USER_ID}',false,NOW(),NOW()),
  -- BLK (IBKR buys)
  ('ord-blk-01','acc-ibkr','${USER_ID}','USD','2025-05-20',1.00,12,'sp-blk','BUY',815.60,'${USER_ID}',false,NOW(),NOW()),
  ('ord-blk-02','acc-ibkr','${USER_ID}','USD','2025-06-10',1.00,8,'sp-blk','BUY',822.40,'${USER_ID}',false,NOW(),NOW()),
  ('ord-blk-03','acc-ibkr','${USER_ID}','USD','2025-07-15',1.00,10,'sp-blk','BUY',838.90,'${USER_ID}',false,NOW(),NOW()),
  ('ord-blk-04','acc-ibkr','${USER_ID}','USD','2025-08-22',1.00,6,'sp-blk','BUY',842.30,'${USER_ID}',false,NOW(),NOW()),
  ('ord-blk-05','acc-ibkr','${USER_ID}','USD','2025-10-08',1.00,8,'sp-blk','BUY',870.10,'${USER_ID}',false,NOW(),NOW()),
  ('ord-blk-06','acc-ibkr','${USER_ID}','USD','2025-12-05',1.00,5,'sp-blk','BUY',898.70,'${USER_ID}',false,NOW(),NOW()),
  ('ord-blk-07','acc-ibkr','${USER_ID}','USD','2026-01-12',1.00,7,'sp-blk','BUY',918.20,'${USER_ID}',false,NOW(),NOW()),
  ('ord-blk-08','acc-ibkr','${USER_ID}','USD','2026-02-20',1.00,4,'sp-blk','BUY',938.50,'${USER_ID}',false,NOW(),NOW()),
  ('ord-blk-09','acc-ibkr','${USER_ID}','USD','2026-03-18',1.00,5,'sp-blk','BUY',945.80,'${USER_ID}',false,NOW(),NOW()),
  -- BLK (Schwab buys)
  ('ord-blk-10','acc-schwab','${USER_ID}','USD','2025-06-25',0.00,15,'sp-blk','BUY',828.50,'${USER_ID}',false,NOW(),NOW()),
  ('ord-blk-11','acc-schwab','${USER_ID}','USD','2025-09-15',0.00,10,'sp-blk','BUY',855.30,'${USER_ID}',false,NOW(),NOW()),
  ('ord-blk-12','acc-schwab','${USER_ID}','USD','2025-11-10',0.00,12,'sp-blk','BUY',882.40,'${USER_ID}',false,NOW(),NOW()),
  ('ord-blk-13','acc-schwab','${USER_ID}','USD','2026-01-28',0.00,8,'sp-blk','BUY',925.60,'${USER_ID}',false,NOW(),NOW()),
  ('ord-blk-14','acc-schwab','${USER_ID}','USD','2026-03-05',0.00,10,'sp-blk','BUY',942.10,'${USER_ID}',false,NOW(),NOW()),
  ('ord-blk-15','acc-schwab','${USER_ID}','USD','2026-04-10',0.00,6,'sp-blk','BUY',944.80,'${USER_ID}',false,NOW(),NOW()),
  -- BLK dividends (~\$5.10/share quarterly)
  ('ord-blk-d1','acc-ibkr','${USER_ID}','USD','2025-09-23',0.00,36,'sp-blk','DIVIDEND',5.10,'${USER_ID}',false,NOW(),NOW()),
  ('ord-blk-d2','acc-ibkr','${USER_ID}','USD','2025-12-23',0.00,44,'sp-blk','DIVIDEND',5.10,'${USER_ID}',false,NOW(),NOW()),
  ('ord-blk-d3','acc-schwab','${USER_ID}','USD','2025-12-23',0.00,37,'sp-blk','DIVIDEND',5.10,'${USER_ID}',false,NOW(),NOW()),
  ('ord-blk-d4','acc-ibkr','${USER_ID}','USD','2026-03-24',0.00,56,'sp-blk','DIVIDEND',5.10,'${USER_ID}',false,NOW(),NOW()),
  ('ord-blk-d5','acc-schwab','${USER_ID}','USD','2026-03-24',0.00,61,'sp-blk','DIVIDEND',5.10,'${USER_ID}',false,NOW(),NOW()),
  -- BLK partial sell
  ('ord-blk-s1','acc-ibkr','${USER_ID}','USD','2026-04-15',1.00,10,'sp-blk','SELL',946.30,'${USER_ID}',false,NOW(),NOW())
ON CONFLICT DO NOTHING;
SQL

echo "==> Demo data seeded."
echo "    Login token: ${PLAINTEXT_TOKEN}"
