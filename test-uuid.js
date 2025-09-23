#!/usr/bin/env node

const postgres = require('postgres');

// Test UUID generation and database queries
async function testUUIDHandling() {
  console.log('Testing UUID generation and database queries...\n');

  const connectionString = process.env.POSTGRES_URL;
  const sql = postgres(connectionString, {
    connect_timeout: 10,
    idle_timeout: 120,
    max_lifetime: 60 * 60,
    max: 3,
  });

  try {
    // Test our custom UUID generator
    function generateUUID() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    }

    // Test crypto.randomUUID if available
    function generateCryptoUUID() {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
      }
      return null;
    }

    console.log('🔧 Testing UUID generators:');
    const customUUID = generateUUID();
    const cryptoUUID = generateCryptoUUID();

    console.log(`Custom UUID: ${customUUID}`);
    console.log(`Crypto UUID: ${cryptoUUID || 'Not available'}`);

    // Test if existing chat IDs work
    console.log('\n🔍 Testing existing chat retrieval:');
    const existingChats = await sql`SELECT id, title FROM "Chat" LIMIT 3`;

    for (const chat of existingChats) {
      console.log(`\nTesting chat ID: ${chat.id}`);

      // Test exact query like the app does
      const [foundChat] = await sql`SELECT * FROM "Chat" WHERE id = ${chat.id}`;

      if (foundChat) {
        console.log(`✅ Found: ${foundChat.title}`);
      } else {
        console.log(`❌ Not found despite existing in database!`);
      }
    }

    // Test if our UUID generator creates valid UUIDs for PostgreSQL
    console.log('\n🧪 Testing UUID creation with our generator:');
    const testId = generateUUID();
    const testTitle = `Test Chat ${Date.now()}`;
    const testUserId = 'test_user_123';

    try {
      await sql`
        INSERT INTO "Chat" (id, "createdAt", title, "userId", visibility)
        VALUES (${testId}, NOW(), ${testTitle}, ${testUserId}, 'private')
      `;
      console.log(`✅ Successfully inserted chat with custom UUID: ${testId}`);

      // Try to retrieve it
      const [retrievedChat] = await sql`SELECT * FROM "Chat" WHERE id = ${testId}`;
      if (retrievedChat) {
        console.log(`✅ Successfully retrieved inserted chat: ${retrievedChat.title}`);

        // Clean up
        await sql`DELETE FROM "Chat" WHERE id = ${testId}`;
        console.log(`✅ Cleanup successful`);
      } else {
        console.log(`❌ Could not retrieve chat we just inserted!`);
      }

    } catch (error) {
      console.log(`❌ Error inserting/retrieving test chat: ${error.message}`);
    }

    // Test UUID validation
    console.log('\n🔍 Testing UUID format validation:');
    const testUUIDs = [
      customUUID,
      '550e8400-e29b-41d4-a716-446655440000', // Standard UUID
      'invalid-uuid', // Invalid
      '123e4567-e89b-12d3-a456-426614174000', // Valid UUID
    ];

    for (const uuid of testUUIDs) {
      try {
        // This will throw if UUID format is invalid for PostgreSQL
        await sql`SELECT ${uuid}::uuid as test_uuid`;
        console.log(`✅ Valid UUID format: ${uuid}`);
      } catch (error) {
        console.log(`❌ Invalid UUID format: ${uuid} - ${error.message}`);
      }
    }

    await sql.end();
    console.log('\n✅ UUID testing completed');

  } catch (error) {
    console.error('❌ Error during UUID testing:', error.message);
    await sql.end();
    process.exit(1);
  }
}

testUUIDHandling().catch(console.error);