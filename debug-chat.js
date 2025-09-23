#!/usr/bin/env node

const postgres = require('postgres');

async function debugChatIssue() {
  console.log('🔍 Debugging chat retrieval issue...\n');

  const connectionString = process.env.POSTGRES_URL;
  const sql = postgres(connectionString, {
    connect_timeout: 10,
    idle_timeout: 120,
    max_lifetime: 60 * 60,
    max: 3,
  });

  try {
    // Get a real chat ID to test with
    const [sampleChat] = await sql`SELECT id, title, "userId" FROM "Chat" LIMIT 1`;

    if (!sampleChat) {
      console.log('❌ No chats found in database');
      await sql.end();
      return;
    }

    console.log(`📋 Testing with existing chat:`);
    console.log(`   ID: ${sampleChat.id}`);
    console.log(`   Title: ${sampleChat.title}`);
    console.log(`   User ID: ${sampleChat.userId}`);

    // Test the exact query from getChatById function
    console.log('\n🔍 Testing getChatById query pattern:');

    const getChatByIdResult = await sql`
      SELECT * FROM "Chat" WHERE id = ${sampleChat.id}
    `;

    console.log(`Query result count: ${getChatByIdResult.length}`);

    if (getChatByIdResult.length > 0) {
      console.log('✅ getChatById query works correctly');
    } else {
      console.log('❌ getChatById query failed - this is the issue!');
    }

    // Test with different parameter binding approaches
    console.log('\n🧪 Testing different query approaches:');

    // Approach 1: Direct string interpolation (unsafe but for testing)
    try {
      const directResult = await sql.unsafe(`SELECT * FROM "Chat" WHERE id = '${sampleChat.id}'`);
      console.log(`Direct interpolation: ${directResult.length} results`);
    } catch (error) {
      console.log(`Direct interpolation failed: ${error.message}`);
    }

    // Approach 2: Explicit casting
    try {
      const castResult = await sql`SELECT * FROM "Chat" WHERE id = ${sampleChat.id}::uuid`;
      console.log(`With explicit casting: ${castResult.length} results`);
    } catch (error) {
      console.log(`Explicit casting failed: ${error.message}`);
    }

    // Approach 3: Using array parameter
    try {
      const arrayResult = await sql`SELECT * FROM "Chat" WHERE id = ANY(${[sampleChat.id]})`;
      console.log(`Array parameter: ${arrayResult.length} results`);
    } catch (error) {
      console.log(`Array parameter failed: ${error.message}`);
    }

    // Test if the issue is with Drizzle ORM vs raw postgres
    console.log('\n🔧 Simulating Drizzle ORM query structure:');

    // This mimics how Drizzle constructs the query
    const drizzleLikeQuery = await sql`
      SELECT "Chat"."id", "Chat"."createdAt", "Chat"."title", "Chat"."userId", "Chat"."visibility", "Chat"."lastContext"
      FROM "Chat"
      WHERE "Chat"."id" = ${sampleChat.id}
      LIMIT 1
    `;

    console.log(`Drizzle-like query: ${drizzleLikeQuery.length} results`);

    if (drizzleLikeQuery.length > 0) {
      console.log('✅ Drizzle-style query works');
    } else {
      console.log('❌ Drizzle-style query failed');
    }

    // Check for any encoding or type issues
    console.log('\n🔍 Debugging UUID value:');
    console.log(`UUID type: ${typeof sampleChat.id}`);
    console.log(`UUID length: ${sampleChat.id.length}`);
    console.log(`UUID format: ${sampleChat.id}`);
    console.log(`Is valid UUID regex: ${/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sampleChat.id)}`);

    await sql.end();
    console.log('\n✅ Chat debugging completed');

  } catch (error) {
    console.error('❌ Error during chat debugging:', error);
    await sql.end();
    process.exit(1);
  }
}

debugChatIssue().catch(console.error);