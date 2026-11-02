"""Minimal copy of the migrated SQLite table layout for safe local tests."""
import sqlite3


def build(db):
    db.executescript("""
    PRAGMA foreign_keys=ON;
    CREATE TABLE tracked_items (
      id TEXT PRIMARY KEY,item_type TEXT NOT NULL,name TEXT NOT NULL,
      currency TEXT NOT NULL,unit TEXT,target_price TEXT,comparison_quantity TEXT NOT NULL,
      target_unit_price TEXT,current_price TEXT,current_quantity TEXT,current_unit_price TEXT,
      previous_price TEXT,previous_quantity TEXT,previous_unit_price TEXT,
      check_interval_minutes INTEGER,tracking_enabled INTEGER NOT NULL,last_checked_at TEXT,
      last_successful_price_at TEXT,last_price_changed_at TEXT,archived_at TEXT,
      created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
    CREATE TABLE item_sources (
      id INTEGER PRIMARY KEY,item_id TEXT NOT NULL,store TEXT NOT NULL,url TEXT,
      scraping_enabled INTEGER NOT NULL,default_quantity TEXT NOT NULL,note TEXT,
      archived_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
      UNIQUE(item_id,id),FOREIGN KEY(item_id) REFERENCES tracked_items(id));
    CREATE TABLE scrape_runs (
      id TEXT PRIMARY KEY,started_at TEXT NOT NULL,finished_at TEXT,status TEXT NOT NULL,
      total_items INTEGER NOT NULL,successful INTEGER NOT NULL,failed INTEGER NOT NULL,
      suspicious INTEGER NOT NULL);
    CREATE TABLE scrape_results (
      id INTEGER PRIMARY KEY,run_id TEXT NOT NULL,item_id TEXT NOT NULL,source_id INTEGER NOT NULL,
      scraped_price TEXT,scraped_quantity TEXT,scraped_unit_price TEXT,
      result_status TEXT NOT NULL,error TEXT,suspicious_reason TEXT,
      review_status TEXT NOT NULL,review_note TEXT,reviewed_at TEXT,
      observed_at TEXT NOT NULL,created_at TEXT NOT NULL,
      UNIQUE(run_id,source_id),FOREIGN KEY(run_id) REFERENCES scrape_runs(id),
      FOREIGN KEY(item_id,source_id) REFERENCES item_sources(item_id,id));
    CREATE TABLE price_history (
      id INTEGER PRIMARY KEY,item_id TEXT NOT NULL,source_id INTEGER NOT NULL,
      scrape_result_id INTEGER UNIQUE,price TEXT NOT NULL,quantity TEXT NOT NULL,
      unit_price TEXT NOT NULL,origin TEXT NOT NULL,recorded_at TEXT NOT NULL,
      FOREIGN KEY(item_id,source_id) REFERENCES item_sources(item_id,id),
      FOREIGN KEY(scrape_result_id) REFERENCES scrape_results(id));
    CREATE TABLE best_price_states (
      id INTEGER PRIMARY KEY,item_id TEXT NOT NULL,unit_price TEXT NOT NULL,
      cause TEXT NOT NULL,recorded_at TEXT NOT NULL,UNIQUE(item_id,id),
      FOREIGN KEY(item_id) REFERENCES tracked_items(id));
    CREATE TABLE best_price_state_sources (
      item_id TEXT NOT NULL,best_price_state_id INTEGER NOT NULL,source_id INTEGER NOT NULL,
      PRIMARY KEY(best_price_state_id,source_id),
      FOREIGN KEY(item_id,best_price_state_id) REFERENCES best_price_states(item_id,id),
      FOREIGN KEY(item_id,source_id) REFERENCES item_sources(item_id,id));
    CREATE TABLE price_alert_events (
      id INTEGER PRIMARY KEY,item_id TEXT NOT NULL,best_price_state_id INTEGER NOT NULL,
      unit_price TEXT NOT NULL,target_unit_price TEXT NOT NULL,status TEXT NOT NULL,
      created_at TEXT NOT NULL,sent_at TEXT,error TEXT,
      UNIQUE(best_price_state_id));
    """)
    db.execute("""INSERT INTO tracked_items(id,item_type,name,currency,comparison_quantity,
       tracking_enabled,created_at,updated_at) VALUES ('item1','Product','Test','SEK','1',1,'now','now')""")
    db.execute("""INSERT INTO item_sources(id,item_id,store,url,scraping_enabled,
       default_quantity,created_at,updated_at) VALUES (1,'item1','Test Shop',
       'https://example.com',1,'1','now','now')""")
    db.execute("""INSERT INTO scrape_runs(id,started_at,status,total_items,successful,failed,suspicious)
       VALUES ('run1','now','Running',1,0,0,0)""")
    db.commit()
