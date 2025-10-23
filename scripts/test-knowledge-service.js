#!/usr/bin/env node

/**
 * Test KnowledgeService Hybrid Search Methods
 *
 * Purpose: Verify searchForUsers(), searchForAI(), and recordFeedback() work correctly
 * Usage: node scripts/test-knowledge-service.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const KnowledgeService = require('../services/knowledge_service');

// Initialize clients
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Initialize KnowledgeService
const knowledgeService = new KnowledgeService(supabase, null, openai);

/**
 * Test searchForUsers() method
 */
async function testSearchForUsers() {
  console.log('\n🧪 Test 1: searchForUsers()');
  console.log('─'.repeat(80));

  const queries = [
    { q: 'how to add candidate', threshold: 0.7 },
    { q: 'create job posting', threshold: 0.7 },
    { q: 'pipeline stages', threshold: 0.6 }
  ];

  for (const { q, threshold } of queries) {
    console.log(`\n Query: "${q}" (threshold: ${threshold})`);
    try {
      const results = await knowledgeService.searchForUsers(q, threshold, 3);

      if (results.length === 0) {
        console.log('   No results found');
      } else {
        results.forEach((r, i) => {
          console.log(`   ${i + 1}. [${r.confidence.toUpperCase()}] ${r.question}`);
          console.log(`      Similarity: ${(r.similarity * 100).toFixed(1)}% | Category: ${r.category}`);
        });
      }
    } catch (error) {
      console.error('   ❌ Error:', error.message);
    }

    // Rate limit
    await new Promise(resolve => setTimeout(resolve, 350));
  }
}

/**
 * Test searchForAI() method
 */
async function testSearchForAI() {
  console.log('\n\n🧪 Test 2: searchForAI()');
  console.log('─'.repeat(80));

  const query = 'user having trouble with permissions';

  console.log(`\n Query: "${query}"`);
  try {
    const results = await knowledgeService.searchForAI(query, 5);

    if (results.length === 0) {
      console.log('   No results found');
    } else {
      console.log(`   ✅ Found ${results.length} KB entries for AI context:`);
      results.forEach((r, i) => {
        console.log(`   ${i + 1}. [${(r.similarity * 100).toFixed(1)}%] ${r.question}`);
        console.log(`      Category: ${r.category}`);
      });

      // Estimate token savings
      const avgTokensPerEntry = 50; // rough estimate
      const contextTokens = results.length * avgTokensPerEntry;
      const fullKBTokens = 1200; // approximate
      const savings = ((1 - contextTokens / fullKBTokens) * 100).toFixed(0);
      console.log(`\n   📊 Token usage: ~${contextTokens} tokens (vs ~${fullKBTokens} for full KB)`);
      console.log(`   💰 Token savings: ~${savings}%`);
    }
  } catch (error) {
    console.error('   ❌ Error:', error.message);
  }
}

/**
 * Test recordFeedback() method
 */
async function testRecordFeedback() {
  console.log('\n\n🧪 Test 3: recordFeedback()');
  console.log('─'.repeat(80));

  try {
    // Get the first KB entry
    const { data: entries, error } = await supabase
      .schema('support')
      .from('knowledge_base')
      .select('id, question, helpful_count, not_helpful_count')
      .limit(1)
      .single();

    if (error || !entries) {
      console.log('   ❌ Could not fetch test entry:', error?.message);
      return;
    }

    console.log(`\n Testing with: "${entries.question}"`);
    console.log(`   Before: 👍 ${entries.helpful_count || 0} | 👎 ${entries.not_helpful_count || 0}`);

    // Test helpful feedback
    const helpfulResult = await knowledgeService.recordFeedback(entries.id, true);
    console.log(`   Helpful feedback recorded: ${helpfulResult ? '✅' : '❌'}`);

    // Fetch updated counts
    const { data: updated } = await supabase
      .schema('support')
      .from('knowledge_base')
      .select('helpful_count, not_helpful_count')
      .eq('id', entries.id)
      .single();

    if (updated) {
      console.log(`   After: 👍 ${updated.helpful_count || 0} | 👎 ${updated.not_helpful_count || 0}`);
      const countIncreased = updated.helpful_count > (entries.helpful_count || 0);
      console.log(`   Count increased: ${countIncreased ? '✅' : '❌'}`);
    }

  } catch (error) {
    console.error('   ❌ Error:', error.message);
  }
}

/**
 * Main test runner
 */
async function main() {
  console.log('🚀 Knowledge Service Hybrid Search Tests');
  console.log('═'.repeat(80));

  try {
    await testSearchForUsers();
    await testSearchForAI();
    await testRecordFeedback();

    console.log('\n' + '═'.repeat(80));
    console.log('✅ All tests completed!\n');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Execute
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
