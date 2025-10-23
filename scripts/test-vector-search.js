#!/usr/bin/env node

/**
 * Test Vector Search Script
 *
 * Purpose: Verify that vector similarity search returns relevant results
 * Usage: node scripts/test-vector-search.js
 */

require('dotenv').config();
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');

// Initialize clients
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

/**
 * Generate embedding for test query
 */
async function generateEmbedding(text) {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
    dimensions: EMBEDDING_DIMENSIONS
  });
  return response.data[0].embedding;
}

/**
 * Test similarity search with a query
 */
async function testSearch(query, matchThreshold = 0.7, matchCount = 5) {
  console.log(`\n🔍 Query: "${query}"`);
  console.log('─'.repeat(80));

  try {
    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query);

    // Call match_knowledge RPC function (in support schema)
    const { data, error } = await supabase
      .schema('support')
      .rpc('match_knowledge', {
        query_embedding: queryEmbedding,
        match_threshold: matchThreshold,
        match_count: matchCount
      });

    if (error) {
      console.error('❌ Search error:', error);
      return;
    }

    if (!data || data.length === 0) {
      console.log('❌ No results found (try lowering match_threshold)');
      return;
    }

    console.log(`✅ Found ${data.length} relevant results:\n`);

    data.forEach((result, index) => {
      const similarityPercent = (result.similarity * 100).toFixed(1);
      console.log(`${index + 1}. [Similarity: ${similarityPercent}%] ${result.question}`);
      console.log(`   Category: ${result.category}`);
      console.log(`   Answer: ${result.answer.substring(0, 100)}...`);
      console.log();
    });

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

/**
 * Main test runner
 */
async function main() {
  console.log('🧪 Vector Search Test Suite');
  console.log('═'.repeat(80));

  // Test cases covering different categories
  const testQueries = [
    { query: 'add new candidate', category: 'Candidates' },
    { query: 'create job', category: 'Jobs' },
    { query: 'expense claim', category: 'Claims' },
    { query: 'calendar meeting', category: 'Calendar' },
    { query: 'data not showing', category: 'System' },
    { query: 'pipeline stages', category: 'Pipeline' }
  ];

  for (const test of testQueries) {
    await testSearch(test.query, 0.5, 3);
    await new Promise(resolve => setTimeout(resolve, 350)); // Rate limit
  }

  console.log('═'.repeat(80));
  console.log('✅ All tests completed!\n');
}

// Execute
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
