#!/usr/bin/env node

/**
 * Generate Knowledge Base Embeddings Script
 *
 * Purpose: Generate vector embeddings for all KB entries without embeddings
 * Usage: node scripts/generate-kb-embeddings.js
 *
 * Features:
 * - Reads entries from support.knowledge_base where embedding IS NULL
 * - Generates embeddings using OpenAI text-embedding-3-small model
 * - Updates database with generated embeddings
 * - Rate limiting: 350ms between API calls
 * - Progress logging and error handling
 * - Retry logic for failed API calls
 */

require('dotenv').config();
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');

// Configuration
const RATE_LIMIT_MS = 350; // Rate limit between API calls
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// Validate environment variables
if (!process.env.OPENAI_API_KEY) {
  console.error('❌ Error: OPENAI_API_KEY environment variable is not set');
  process.exit(1);
}

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.error('❌ Error: SUPABASE_URL or SUPABASE_ANON_KEY environment variable is not set');
  process.exit(1);
}

// Initialize clients
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

/**
 * Sleep utility for rate limiting
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate embedding for a single text using OpenAI
 */
async function generateEmbedding(text, retries = 0) {
  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
      dimensions: EMBEDDING_DIMENSIONS
    });

    return response.data[0].embedding;
  } catch (error) {
    if (retries < MAX_RETRIES) {
      console.warn(`   ⚠️  API error, retrying in ${RETRY_DELAY_MS}ms (attempt ${retries + 1}/${MAX_RETRIES})...`);
      await sleep(RETRY_DELAY_MS);
      return generateEmbedding(text, retries + 1);
    }
    throw error;
  }
}

/**
 * Update database with generated embedding
 */
async function updateEmbedding(id, embedding) {
  const { error } = await supabase
    .schema('support')
    .from('knowledge_base')
    .update({ embedding: JSON.stringify(embedding) })
    .eq('id', id);

  if (error) {
    throw new Error(`Database update failed: ${error.message}`);
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('🚀 Knowledge Base Embedding Generation');
  console.log('=====================================\n');

  // Fetch entries without embeddings
  console.log('📥 Fetching entries without embeddings...');
  const { data: entries, error: fetchError } = await supabase
    .schema('support')
    .from('knowledge_base')
    .select('id, question, answer, category')
    .is('embedding', null)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (fetchError) {
    console.error('❌ Error fetching entries:', fetchError);
    process.exit(1);
  }

  if (!entries || entries.length === 0) {
    console.log('✅ No entries need embeddings. All done!');
    process.exit(0);
  }

  console.log(`📊 Found ${entries.length} entries needing embeddings\n`);

  // Process each entry
  let successCount = 0;
  let failCount = 0;
  const startTime = Date.now();

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const progress = `[${i + 1}/${entries.length}]`;

    try {
      console.log(`${progress} Processing: "${entry.question.substring(0, 60)}..."`);
      console.log(`   📁 Category: ${entry.category}`);

      // Combine question and answer for embedding
      const textToEmbed = `${entry.question}\n\n${entry.answer}`;

      // Generate embedding
      console.log('   🤖 Generating embedding...');
      const embedding = await generateEmbedding(textToEmbed);

      // Verify embedding dimensions
      if (embedding.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(`Invalid embedding dimensions: expected ${EMBEDDING_DIMENSIONS}, got ${embedding.length}`);
      }

      // Update database
      console.log('   💾 Updating database...');
      await updateEmbedding(entry.id, embedding);

      successCount++;
      console.log(`   ✅ Success! (${successCount}/${entries.length})\n`);

      // Rate limiting (except for last item)
      if (i < entries.length - 1) {
        await sleep(RATE_LIMIT_MS);
      }

    } catch (error) {
      failCount++;
      console.error(`   ❌ Failed: ${error.message}\n`);
      // Continue with next entry instead of exiting
    }
  }

  // Summary
  const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('\n=====================================');
  console.log('📊 Generation Summary');
  console.log('=====================================');
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`⏱️  Time elapsed: ${elapsedTime}s`);
  console.log(`⚡ Average time per entry: ${(elapsedTime / entries.length).toFixed(2)}s`);

  if (failCount > 0) {
    console.log('\n⚠️  Some entries failed. Re-run this script to retry failed entries.');
    process.exit(1);
  } else {
    console.log('\n🎉 All embeddings generated successfully!');
    process.exit(0);
  }
}

// Execute
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
