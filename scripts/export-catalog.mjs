#!/usr/bin/env node
/**
 * Writes the fallback catalog in src/site/lessons.js as JSON, for the one-time
 * move into the backend:
 *
 *   node scripts/export-catalog.mjs > catalog.json
 *   cd backend && python manage.py import_lessons ../catalog.json ../public/lesson-files
 *
 * (lessons.js is an ES module that only exports data, so importing it here is safe.)
 */
import { CATEGORIES } from '../src/site/lessons.js';

process.stdout.write(JSON.stringify({ categories: CATEGORIES }, null, 1) + '\n');
