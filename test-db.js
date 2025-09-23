#!/usr/bin/env node

const postgres = require('postgres');

async function testDatabase() {
  console.log('Testing database connectivity...\n');

  // Get the connection string from environment
  const connectionString = process.env.POSTGRES_URL;

  if (!connectionString) {
    console.error('❌ POSTGRES_URL environment variable not found');
    process.exit(1);
  }

  console.log('✓ POSTGRES_URL found');

  let sql;
  try {
    // Create connection
    sql = postgres(connectionString, {
      connect_timeout: 10,
      idle_timeout: 120,
      max_lifetime: 60 * 60,
      max: 3,
    });

    console.log('✓ Database connection created');

    // Test basic connectivity
    const result = await sql`SELECT NOW() as current_time, version() as pg_version`;
    console.log('✓ Database connection successful');
    console.log(`Current time: ${result[0].current_time}`);
    console.log(`PostgreSQL version: ${result[0].pg_version}\n`);

    // Check if Chat table exists
    console.log('Checking table schema...');

    const tables = await sql`
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name IN ('Chat', 'Message_v2', 'User', 'Stream')
      ORDER BY table_name, ordinal_position
    `;

    if (tables.length === 0) {
      console.log('❌ No tables found! Database may not be migrated.');
    } else {
      console.log('✓ Tables found:');

      const tablesByName = {};
      tables.forEach(table => {
        if (!tablesByName[table.table_name]) {
          tablesByName[table.table_name] = [];
        }
        tablesByName[table.table_name].push(table);
      });

      Object.keys(tablesByName).forEach(tableName => {
        console.log(`\n📋 ${tableName}:`);
        tablesByName[tableName].forEach(col => {
          console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : '(NULLABLE)'}`);
        });
      });
    }

    // Check for existing chats
    console.log('\nChecking existing chat data...');
    try {
      const chatCount = await sql`SELECT COUNT(*) as count FROM "Chat"`;
      console.log(`✓ Chat table accessible. Found ${chatCount[0].count} chats.`);

      if (chatCount[0].count > 0) {
        const sampleChats = await sql`SELECT id, title, "userId", visibility, "createdAt" FROM "Chat" LIMIT 3`;
        console.log('\n📝 Sample chats:');
        sampleChats.forEach((chat, i) => {
          console.log(`${i + 1}. ID: ${chat.id} | Title: ${chat.title} | User: ${chat.userId}`);
        });
      }
    } catch (error) {
      console.log('❌ Error accessing Chat table:', error.message);
    }

    await sql.end();
    console.log('\n✅ Database test completed successfully');

  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    if (sql) await sql.end();
    process.exit(1);
  }
}

testDatabase().catch(console.error);