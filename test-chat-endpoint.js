#!/usr/bin/env node

// Test the actual API endpoints directly to isolate the issue

async function testChatEndpoints() {
  console.log('🔍 Testing chat API endpoints...\n');

  const baseUrl = 'http://localhost:3000';

  // Test existing chat ID
  const testChatId = '555e1aab-de51-4f9f-8709-d10f8cf89dbe';

  console.log('📋 Testing chat API routes:');

  // Test 1: Chat API POST (requires auth)
  console.log('\n1. Testing POST /api/chat (expect 401)');
  try {
    const postResponse = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: testChatId,
        message: { id: 'test', role: 'user', parts: [{ type: 'text', text: 'test' }] },
        selectedChatModel: 'test-model',
        selectedVisibilityType: 'private'
      })
    });

    console.log(`Status: ${postResponse.status}`);
    const text = await postResponse.text();
    console.log(`Response: ${text.substring(0, 200)}`);
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }

  // Test 2: Stream API GET (requires auth)
  console.log('\n2. Testing GET /api/chat/[id]/stream (expect 401)');
  try {
    const streamResponse = await fetch(`${baseUrl}/api/chat/${testChatId}/stream`);
    console.log(`Status: ${streamResponse.status}`);
    const text = await streamResponse.text();
    console.log(`Response: ${text.substring(0, 200)}`);
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }

  // Test 3: Models API (should be public)
  console.log('\n3. Testing GET /api/models (should be public)');
  try {
    const modelsResponse = await fetch(`${baseUrl}/api/models`);
    console.log(`Status: ${modelsResponse.status}`);
    const text = await modelsResponse.text();
    console.log(`Response: ${text.substring(0, 200)}`);
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }

  // Test 4: Chat page route (should redirect to login)
  console.log('\n4. Testing GET /chat/[id] page (expect redirect)');
  try {
    const chatPageResponse = await fetch(`${baseUrl}/chat/${testChatId}`, {
      redirect: 'manual' // Don't follow redirects
    });
    console.log(`Status: ${chatPageResponse.status}`);
    console.log(`Location header: ${chatPageResponse.headers.get('location')}`);
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }

  // Test 5: Invalid UUID format
  console.log('\n5. Testing with invalid UUID format');
  try {
    const invalidResponse = await fetch(`${baseUrl}/chat/invalid-uuid`, {
      redirect: 'manual'
    });
    console.log(`Status: ${invalidResponse.status}`);
    console.log(`Location header: ${invalidResponse.headers.get('location')}`);
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }

  console.log('\n✅ Endpoint testing completed');
}

testChatEndpoints().catch(console.error);