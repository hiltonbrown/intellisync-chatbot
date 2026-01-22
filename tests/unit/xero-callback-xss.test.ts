import { test } from 'node:test';
import assert from 'node:assert';
import escapeHtml from 'escape-html';

/**
 * Test suite for XSS prevention in Xero OAuth callback error handling
 * 
 * This tests the fix for code scanning alert #4 (Reflected XSS)
 * in app/api/xero/callback/route.ts
 */

test('escapeHtml properly escapes HTML special characters', () => {
	const maliciousInput = '<script>alert("XSS")</script>';
	const escaped = escapeHtml(maliciousInput);
	
	// Verify that < and > are escaped
	assert.ok(!escaped.includes('<'));
	assert.ok(!escaped.includes('>'));
	assert.ok(escaped.includes('&lt;'));
	assert.ok(escaped.includes('&gt;'));
	
	// Verify the escaped output
	assert.strictEqual(escaped, '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
});

test('escapeHtml escapes double quotes', () => {
	const input = 'Error: "invalid_token"';
	const escaped = escapeHtml(input);
	
	assert.ok(escaped.includes('&quot;'));
	assert.strictEqual(escaped, 'Error: &quot;invalid_token&quot;');
});

test('escapeHtml escapes single quotes', () => {
	const input = "Error: 'access_denied'";
	const escaped = escapeHtml(input);
	
	assert.ok(escaped.includes('&#39;'));
	assert.strictEqual(escaped, 'Error: &#39;access_denied&#39;');
});

test('escapeHtml escapes ampersands', () => {
	const input = 'Error: token_expired&redirect=true';
	const escaped = escapeHtml(input);
	
	// Ampersands should be escaped
	assert.ok(escaped.includes('&amp;'));
	assert.strictEqual(escaped, 'Error: token_expired&amp;redirect=true');
});

test('escapeHtml handles all dangerous characters together', () => {
	const input = '<img src=x onerror="alert(\'XSS\')" & onload=alert(1)>';
	const escaped = escapeHtml(input);
	
	// All special characters should be escaped
	// Note: escapeHtml escapes <, >, &, ", ' but preserves the text content
	assert.ok(!escaped.includes('<img'), 'Should not contain opening tag');
	assert.ok(!escaped.includes('</'), 'Should not contain closing tag marker');
	assert.strictEqual(
		escaped,
		'&lt;img src=x onerror=&quot;alert(&#39;XSS&#39;)&quot; &amp; onload=alert(1)&gt;'
	);
});

test('escapeHtml preserves safe text', () => {
	const safeInput = 'access_denied';
	const escaped = escapeHtml(safeInput);
	
	// Safe text should remain unchanged
	assert.strictEqual(escaped, safeInput);
});

test('escapeHtml handles empty string', () => {
	const escaped = escapeHtml('');
	assert.strictEqual(escaped, '');
});

test('escapeHtml prevents common XSS attack vectors', () => {
	const attackVectors = [
		'<script>alert(document.cookie)</script>',
		'<img src=x onerror=alert(1)>',
		'<iframe src="javascript:alert(1)"></iframe>',
		'<svg onload=alert(1)>',
		'"><script>alert(1)</script>',
		"'><script>alert(1)</script>",
	];
	
	for (const vector of attackVectors) {
		const escaped = escapeHtml(vector);
		
		// The key security feature is that < and > are escaped
		// This prevents the browser from interpreting the text as HTML tags
		assert.ok(!escaped.includes('<script'), `Should not contain <script tag in: ${vector}`);
		assert.ok(!escaped.includes('<img'), `Should not contain <img tag in: ${vector}`);
		assert.ok(!escaped.includes('<iframe'), `Should not contain <iframe tag in: ${vector}`);
		assert.ok(!escaped.includes('<svg'), `Should not contain <svg tag in: ${vector}`);
		
		// Verify essential characters are escaped
		if (vector.includes('<')) {
			assert.ok(escaped.includes('&lt;'), `Failed to escape < in: ${vector}`);
		}
		if (vector.includes('>')) {
			assert.ok(escaped.includes('&gt;'), `Failed to escape > in: ${vector}`);
		}
	}
});

test('escapeHtml prevents protocol-relative XSS', () => {
	const input = '//evil.com/xss.js';
	const escaped = escapeHtml(input);
	
	// While this doesn't contain HTML chars, verify it passes through safely
	// The URL sanitization is handled elsewhere in the codebase
	assert.strictEqual(escaped, '//evil.com/xss.js');
});

test('escapeHtml prevents event handler injection', () => {
	const input = '" onmouseover="alert(1)"';
	const escaped = escapeHtml(input);
	
	// Quotes should be escaped, preventing attribute breakout
	assert.ok(escaped.includes('&quot;'));
	assert.strictEqual(escaped, '&quot; onmouseover=&quot;alert(1)&quot;');
});
