#!/usr/bin/env node

// Comprehensive model testing script for OpenRouter
const https = require('https');
// Simple UUID generator
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Models to test based on your codebase configuration
const MODELS_TO_TEST = [
  // Primary models from your config
  'google/gemini-2.5-flash',
  'google/gemini-flash-1.5',
  'openai/gpt-4o-mini',
  'mistralai/mistral-large',

  // Free models from entitlements
  'openai/gpt-oss-120b:free',
  'meta-llama/llama-4-maverick:free',
  'google/gemma-3-27b-it:free',

  // Additional popular models to test
  'anthropic/claude-3-5-sonnet',
  'meta-llama/llama-3.1-8b-instruct',
  'mistralai/mistral-7b-instruct',
  'openai/gpt-4o',
  'google/gemini-pro',
];

const TEST_MESSAGE = "Hello! Please respond with exactly: 'Model test successful - [MODEL_NAME]' where [MODEL_NAME] is your model name.";

class ModelTester {
  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    this.appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ledgerbot.co';
    this.baseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai';
    this.results = [];
  }

  async testChatAPI(model) {
    const chatId = uuidv4();
    const messageId = uuidv4();

    const requestData = {
      id: chatId,
      message: {
        id: messageId,
        role: 'user',
        parts: [{ type: 'text', text: TEST_MESSAGE }]
      },
      selectedChatModel: model,
      selectedVisibilityType: 'private'
    };

    return new Promise((resolve) => {
      const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/chat',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000
      };

      const req = https.request(options, (res) => {
        let data = '';
        let hasTextResponse = false;
        let responseText = '';

        res.on('data', (chunk) => {
          data += chunk.toString();

          // Parse SSE data for text responses
          const lines = data.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const jsonData = JSON.parse(line.substring(6));
                if (jsonData.type === 'text-delta' && jsonData.delta) {
                  hasTextResponse = true;
                  responseText += jsonData.delta;
                }
              } catch (e) {
                // Ignore parse errors for incomplete JSON
              }
            }
          }
        });

        res.on('end', () => {
          resolve({
            model,
            success: res.statusCode === 200 && hasTextResponse,
            statusCode: res.statusCode,
            hasResponse: hasTextResponse,
            responseText: responseText.trim(),
            error: res.statusCode !== 200 ? data : null
          });
        });
      });

      req.on('error', (error) => {
        resolve({
          model,
          success: false,
          error: error.message,
          statusCode: null,
          hasResponse: false,
          responseText: ''
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          model,
          success: false,
          error: 'Request timeout',
          statusCode: null,
          hasResponse: false,
          responseText: ''
        });
      });

      req.write(JSON.stringify(requestData));
      req.end();
    });
  }

  async testOpenRouterDirect(model) {
    const requestData = {
      model: model,
      messages: [
        {
          role: 'user',
          content: TEST_MESSAGE
        }
      ],
      max_tokens: 100,
      temperature: 0.1
    };

    return new Promise((resolve) => {
      const options = {
        hostname: 'openrouter.ai',
        port: 443,
        path: '/api/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': this.appUrl,
          'X-Title': 'IntelliSync Model Test'
        },
        timeout: 30000
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk.toString();
        });

        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const result = JSON.parse(data);
              const responseText = result.choices?.[0]?.message?.content || '';
              resolve({
                model,
                success: true,
                statusCode: res.statusCode,
                responseText: responseText.trim(),
                usage: result.usage
              });
            } else {
              const errorData = JSON.parse(data);
              resolve({
                model,
                success: false,
                statusCode: res.statusCode,
                error: errorData.error?.message || data,
                responseText: ''
              });
            }
          } catch (e) {
            resolve({
              model,
              success: false,
              statusCode: res.statusCode,
              error: `Parse error: ${e.message}. Raw response: ${data}`,
              responseText: ''
            });
          }
        });
      });

      req.on('error', (error) => {
        resolve({
          model,
          success: false,
          error: error.message,
          statusCode: null,
          responseText: ''
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          model,
          success: false,
          error: 'Request timeout',
          statusCode: null,
          responseText: ''
        });
      });

      req.write(JSON.stringify(requestData));
      req.end();
    });
  }

  async runAllTests() {
    console.log('🔍 Starting comprehensive model testing...');
    console.log(`📋 Testing ${MODELS_TO_TEST.length} models`);
    console.log(`🔑 API Key: ${this.apiKey ? this.apiKey.substring(0, 10) + '...' : 'NOT SET'}\n`);

    if (!this.apiKey) {
      console.error('❌ OPENROUTER_API_KEY is not set');
      process.exit(1);
    }

    for (let i = 0; i < MODELS_TO_TEST.length; i++) {
      const model = MODELS_TO_TEST[i];
      console.log(`\n📊 Testing ${i + 1}/${MODELS_TO_TEST.length}: ${model}`);

      // Test direct OpenRouter API first
      console.log('  🔗 Testing direct OpenRouter API...');
      const directResult = await this.testOpenRouterDirect(model);

      // Test through chat API
      console.log('  💬 Testing through chat API...');
      const chatResult = await this.testChatAPI(model);

      const result = {
        model,
        directAPI: directResult,
        chatAPI: chatResult,
        overallSuccess: directResult.success && chatResult.success
      };

      this.results.push(result);

      // Display immediate results
      const directStatus = directResult.success ? '✅' : '❌';
      const chatStatus = chatResult.success ? '✅' : '❌';
      const overallStatus = result.overallSuccess ? '✅' : '❌';

      console.log(`  ${directStatus} Direct API: ${directResult.success ? 'SUCCESS' : directResult.error}`);
      console.log(`  ${chatStatus} Chat API: ${chatResult.success ? 'SUCCESS' : chatResult.error}`);
      console.log(`  ${overallStatus} Overall: ${result.overallSuccess ? 'WORKING' : 'ISSUES FOUND'}`);

      // Show response preview
      if (directResult.responseText) {
        const preview = directResult.responseText.length > 60
          ? directResult.responseText.substring(0, 60) + '...'
          : directResult.responseText;
        console.log(`  💭 Response: "${preview}"`);
      }
    }

    this.printSummary();
  }

  printSummary() {
    console.log('\n' + '='.repeat(80));
    console.log('📈 MODEL TESTING SUMMARY');
    console.log('='.repeat(80));

    const workingModels = this.results.filter(r => r.overallSuccess);
    const partialModels = this.results.filter(r => r.directAPI.success !== r.chatAPI.success);
    const failedModels = this.results.filter(r => !r.directAPI.success && !r.chatAPI.success);

    console.log(`\n✅ FULLY WORKING MODELS (${workingModels.length}):`);
    workingModels.forEach(r => {
      console.log(`  ✓ ${r.model}`);
    });

    if (partialModels.length > 0) {
      console.log(`\n⚠️ PARTIALLY WORKING MODELS (${partialModels.length}):`);
      partialModels.forEach(r => {
        const directStatus = r.directAPI.success ? 'Direct ✓' : 'Direct ✗';
        const chatStatus = r.chatAPI.success ? 'Chat ✓' : 'Chat ✗';
        console.log(`  ~ ${r.model} (${directStatus}, ${chatStatus})`);
      });
    }

    if (failedModels.length > 0) {
      console.log(`\n❌ FAILED MODELS (${failedModels.length}):`);
      failedModels.forEach(r => {
        console.log(`  ✗ ${r.model}`);
        if (r.directAPI.error) console.log(`    Direct API: ${r.directAPI.error}`);
        if (r.chatAPI.error) console.log(`    Chat API: ${r.chatAPI.error}`);
      });
    }

    console.log(`\n📊 STATISTICS:`);
    console.log(`  Total models tested: ${this.results.length}`);
    console.log(`  Fully working: ${workingModels.length} (${Math.round(workingModels.length / this.results.length * 100)}%)`);
    console.log(`  Partially working: ${partialModels.length} (${Math.round(partialModels.length / this.results.length * 100)}%)`);
    console.log(`  Failed: ${failedModels.length} (${Math.round(failedModels.length / this.results.length * 100)}%)`);

    // Recommendations
    console.log(`\n💡 RECOMMENDATIONS:`);
    if (workingModels.length > 0) {
      console.log(`  ✓ Recommended for production: ${workingModels.slice(0, 3).map(r => r.model).join(', ')}`);
    }
    if (failedModels.length > 0) {
      console.log(`  ⚠️ Avoid these models: ${failedModels.slice(0, 3).map(r => r.model).join(', ')}`);
    }

    console.log('\n🎉 Testing complete!');
  }
}

// Run the tests
async function main() {
  const tester = new ModelTester();
  await tester.runAllTests();
}

if (require.main === module) {
  main().catch(console.error);
}