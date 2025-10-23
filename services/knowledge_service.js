// KnowledgeService - Handles all knowledge base operations
// Extracted from server.js as part of Phase 1 refactoring
// Phase 2: Added hybrid search methods (searchForUsers, searchForAI, recordFeedback)

const fs = require('fs');
const path = require('path');

class KnowledgeService {
  constructor(supabaseClient, knowledgeBasePath = null, openaiClient = null) {
    if (!supabaseClient) {
      throw new Error('KnowledgeService requires a Supabase client');
    }

    this.supabase = supabaseClient;
    this.openai = openaiClient; // Optional OpenAI client for embedding generation
    this.knowledgeBasePath = knowledgeBasePath || path.join(__dirname, '..', 'pm-next-documentation.md');
    this.knowledgeBaseTable = 'knowledge_base';
    this.knowledgeBaseSchema = 'support';
    this.knowledgeBaseContent = '';
    this.initialized = false;

    // Embedding configuration
    this.embeddingModel = 'text-embedding-3-small';
    this.embeddingDimensions = 1536;

    // Initial load of static knowledge base
    this._loadStaticKnowledgeBase();

    // Watch for file changes in development
    if (process.env.NODE_ENV !== 'production') {
      fs.watchFile(this.knowledgeBasePath, (curr, prev) => {
        console.log('=� Knowledge base file changed, reloading...');
        this._loadStaticKnowledgeBase();
      });
    }
  }

  /**
   * Load knowledge base from markdown file
   * @returns {string} Knowledge base content
   * @private
   */
  _loadStaticKnowledgeBase() {
    try {
      this.knowledgeBaseContent = fs.readFileSync(this.knowledgeBasePath, 'utf8');
      console.log('=� Knowledge base loaded/reloaded');
      return this.knowledgeBaseContent;
    } catch (error) {
      console.error('L Error loading knowledge base:', error);
      return this.knowledgeBaseContent; // Return existing knowledge base if reload fails
    }
  }

  /**
   * Initialize knowledge base table (check if exists)
   * @private
   */
  async _initKnowledgeBaseTable() {
    try {
      // Check if table exists, if not we'll use the markdown file as fallback
      const { data, error } = await this.supabase
        .from(this.knowledgeBaseTable)
        .select('id')
        .limit(1);

      console.log('=� Knowledge base table check:', error ? 'Using file fallback' : 'Database ready');
    } catch (error) {
      console.log('=� Knowledge base: Using file-based fallback');
    }
  }

  /**
   * Ensure knowledge base is initialized (lazy loading for serverless)
   */
  async initialize() {
    if (!this.initialized) {
      console.log('= Initializing knowledge base (serverless lazy loading)...');
      await this._initKnowledgeBaseTable();
      await this.loadFromDatabase();
      this.initialized = true;
    }
  }

  /**
   * Load knowledge base from file and supplement with database entries
   * @returns {Promise<string>} Combined knowledge base content
   */
  async loadFromDatabase() {
    try {
      // First, always load the static knowledge base from the md file
      let knowledgeBase = this._loadStaticKnowledgeBase();

      // Then try to supplement with dynamic Q&A from database
      const { data, error } = await this.supabase
        .from(this.knowledgeBaseTable)
        .select('*')
        .eq('is_active', true) // Only get active entries
        .order('created_at', { ascending: true });

      if (error) {
        console.log('� Database query failed, using static knowledge base only:', error.message);
        console.log("   Error code:", error.code);
        console.log("   Environment:", process.env.VERCEL ? "Vercel" : "Local");
        console.log("   Supabase URL:", process.env.SUPABASE_URL ? "Set (" + process.env.SUPABASE_URL.substring(0, 30) + "...)" : "MISSING");
        console.log("   Supabase key:", process.env.SUPABASE_ANON_KEY ? "Set (" + process.env.SUPABASE_ANON_KEY.substring(0, 20) + "...)" : "MISSING");

        // Check for common production issues
        if (!process.env.SUPABASE_URL) {
          console.log('L SUPABASE_URL is missing in production environment');
        }
        if (!process.env.SUPABASE_ANON_KEY) {
          console.log('L SUPABASE_ANON_KEY is missing in production environment');
        }
        if (error.message.includes('permission denied') || error.code === '42501') {
          console.log('= RLS permission issue - check Supabase RLS policies');
        }
        if (error.message.includes('relation') && error.message.includes('does not exist')) {
          console.log('=� Table does not exist - check schema and table name');
        }

        return knowledgeBase;
      }

      if (data && data.length > 0) {
        // Find the end of the "Common User Questions and Answers" section
        const questionsSection = '## Common User Questions and Answers';
        const questionsIndex = knowledgeBase.indexOf(questionsSection);

        if (questionsIndex !== -1) {
          // Find the next section or end of file
          const nextSectionIndex = knowledgeBase.indexOf('\n## ', questionsIndex + questionsSection.length);
          const insertIndex = nextSectionIndex !== -1 ? nextSectionIndex : knowledgeBase.length;

          // Build additional Q&A entries from database
          let additionalQA = '\n\n### Additional Support Solutions\n';
          data.forEach(entry => {
            additionalQA += `\n### Q: ${entry.question}\n**A**: ${entry.answer}\n`;
            if (entry.category) {
              additionalQA += `*Category: ${entry.category}*\n`;
            }
          });

          // Insert the database entries before the next section
          knowledgeBase = knowledgeBase.slice(0, insertIndex) + additionalQA + '\n' + knowledgeBase.slice(insertIndex);

          console.log('=� Knowledge base loaded: Static content + ' + data.length + ' dynamic entries from database');
        } else {
          // If we can't find the questions section, append to the end
          let additionalQA = '\n\n## Additional Support Solutions\n';
          data.forEach(entry => {
            additionalQA += `\n### Q: ${entry.question}\n**A**: ${entry.answer}\n`;
            if (entry.category) {
              additionalQA += `*Category: ${entry.category}*\n`;
            }
          });
          knowledgeBase += additionalQA;

          console.log('=� Knowledge base loaded: Static content + ' + data.length + ' dynamic entries (appended)');
        }
      } else {
        console.log('=� Knowledge base loaded: Static content only (no database entries)');
      }

      this.knowledgeBaseContent = knowledgeBase;
      this.initialized = true; // Mark as initialized when successful
      return knowledgeBase;

    } catch (error) {
      console.error('L Error loading from database, using static knowledge base only:', error);
      // Fallback to just the static file content
      const staticKnowledgeBase = this._loadStaticKnowledgeBase();
      console.log('=� Knowledge base loaded: Static content only (database error fallback)');
      return staticKnowledgeBase;
    }
  }

  /**
   * Add Q&A to database
   * @param {Object} qaPair - Q&A pair object with question, answer, category, etc.
   * @returns {Promise<boolean>} Success status
   */
  async addEntry(qaPair) {
    try {
      // First try database approach
      const { data, error } = await this.supabase
        .from(this.knowledgeBaseTable)
        .insert([{
          question: qaPair.question,
          answer: qaPair.answer,
          category: qaPair.category,
          ticket_source: qaPair.ticketNumber || null,
          created_at: new Date().toISOString()
        }])
        .select();

      if (error) {
        console.log('� Database insert failed:', error.message);
        console.log("   Error details:", JSON.stringify(error, null, 2));
        console.log("   Environment check:");
        console.log('   - SUPABASE_URL:', process.env.SUPABASE_URL ? 'Set' : 'Missing');
        console.log('   - SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'Set' : 'Missing');
        console.log('   - VERCEL environment:', process.env.VERCEL ? 'Yes' : 'No');

        // Check if it's a permission issue
        if (error.code === '42501' || error.message.includes('permission denied')) {
          console.log("   Permission denied - RLS policies may need to be configured");
          console.log('=� Check fix-rls-policies.sql for SQL commands to fix this');
        }

        // Don't fallback to file updates in production (Vercel)
        if (process.env.VERCEL) {
          console.log('L Cannot fallback to file updates in Vercel deployment');
          return false;
        }

        // Fallback to file update for local development only
        console.log("   Falling back to file-based knowledge base update...");
        return await this._updateKnowledgeBaseFile(qaPair);
      }

      console.log(' Knowledge base entry added to database');

      // Reload knowledge base (static + database content)
      await this.loadFromDatabase();

      return true;

    } catch (error) {
      console.error('L Error adding to knowledge base:', error);

      // Don't fallback to file updates in production (Vercel)
      if (process.env.VERCEL) {
        console.log('L Cannot fallback to file updates in Vercel deployment');
        return false;
      }

      // Final fallback to file update for local development only
      return await this._updateKnowledgeBaseFile(qaPair);
    }
  }

  /**
   * Update knowledge base file with new Q&A (local development fallback only)
   * @param {Object} qaPair - Q&A pair object
   * @returns {Promise<boolean>} Success status
   * @private
   */
  async _updateKnowledgeBaseFile(qaPair) {
    try {
      let knowledgeBase = fs.readFileSync(this.knowledgeBasePath, 'utf8');

      // Determine where to insert the new Q&A based on category
      const categoryHeaders = {
        'candidate_management': '### Q: How do I add a new candidate?',
        'job_management': '### Q: How do I create a job posting?',
        'client_management': '### Q: How do I track a deal in the pipeline?',
        'authentication': '## Troubleshooting Common Issues',
        'system_performance': '## Troubleshooting Common Issues',
        'general': '## Common User Questions and Answers'
      };

      const category = qaPair.category || 'general';
      const insertAfterHeader = categoryHeaders[category] || categoryHeaders['general'];

      // Format the new Q&A entry
      const newEntry = `
### Q: ${qaPair.question}
**A**: ${qaPair.answer}
`;

      // Find insertion point
      const headerIndex = knowledgeBase.indexOf(insertAfterHeader);
      if (headerIndex === -1) {
        // If header not found, append to end of Common Questions section
        const commonQuestionsIndex = knowledgeBase.indexOf('## Common User Questions and Answers');
        if (commonQuestionsIndex !== -1) {
          const nextSectionIndex = knowledgeBase.indexOf('## ', commonQuestionsIndex + 1);
          const insertIndex = nextSectionIndex !== -1 ? nextSectionIndex : knowledgeBase.length;
          knowledgeBase = knowledgeBase.slice(0, insertIndex) + newEntry + '\n' + knowledgeBase.slice(insertIndex);
        } else {
          // If no Common Questions section, append to end
          knowledgeBase += newEntry;
        }
      } else {
        // Find the end of the current Q&A entry
        const nextQIndex = knowledgeBase.indexOf('\n### Q:', headerIndex + 1);
        const nextSectionIndex = knowledgeBase.indexOf('\n## ', headerIndex + 1);

        let insertIndex;
        if (nextQIndex !== -1 && (nextSectionIndex === -1 || nextQIndex < nextSectionIndex)) {
          insertIndex = nextQIndex;
        } else if (nextSectionIndex !== -1) {
          insertIndex = nextSectionIndex;
        } else {
          insertIndex = knowledgeBase.length;
        }

        knowledgeBase = knowledgeBase.slice(0, insertIndex) + newEntry + knowledgeBase.slice(insertIndex);
      }

      // Write updated knowledge base
      fs.writeFileSync(this.knowledgeBasePath, knowledgeBase);
      console.log('=� Knowledge base updated with new Q&A:', qaPair.question);

      // Reload the knowledge base in memory
      this._loadStaticKnowledgeBase();

      return true;
    } catch (error) {
      console.error('L Error updating knowledge base:', error);
      return false;
    }
  }

  /**
   * Get the current knowledge base content
   * @returns {string} Knowledge base content
   */
  getContent() {
    return this.knowledgeBaseContent;
  }

  /**
   * Get knowledge base statistics
   * @returns {Object} Stats object with size, qaCount, etc.
   */
  getStats() {
    return {
      content: this.knowledgeBaseContent,
      size: Math.round(this.knowledgeBaseContent.length / 1024 * 100) / 100,
      qaCount: (this.knowledgeBaseContent.match(/### Q:/g) || []).length,
      initialized: this.initialized
    };
  }

  /**
   * Force reload from database
   * @returns {Promise<string>} Updated knowledge base content
   */
  async reload() {
    return await this.loadFromDatabase();
  }

  // ============================================================================
  // PHASE 2: HYBRID SEARCH METHODS
  // ============================================================================

  /**
   * Generate embedding for a query using OpenAI
   * @param {string} text - Text to embed
   * @returns {Promise<Array<number>>} Embedding vector
   * @private
   */
  async _generateEmbedding(text) {
    if (!this.openai) {
      throw new Error('OpenAI client not configured. Cannot generate embeddings.');
    }

    try {
      const response = await this.openai.embeddings.create({
        model: this.embeddingModel,
        input: text,
        dimensions: this.embeddingDimensions
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('❌ Error generating embedding:', error.message);
      throw error;
    }
  }

  /**
   * Search knowledge base for direct user responses (KB-first approach)
   * High confidence matches return KB articles directly without AI
   *
   * @param {string} query - User's question
   * @param {number} matchThreshold - Minimum similarity score (0-1), default 0.7
   * @param {number} matchCount - Maximum results to return, default 3
   * @returns {Promise<Array>} Array of matching KB entries with similarity scores
   */
  async searchForUsers(query, matchThreshold = 0.7, matchCount = 3) {
    try {
      // Generate query embedding
      const queryEmbedding = await this._generateEmbedding(query);

      // Call match_knowledge RPC function in support schema
      const { data, error } = await this.supabase
        .schema(this.knowledgeBaseSchema)
        .rpc('match_knowledge', {
          query_embedding: queryEmbedding,
          match_threshold: matchThreshold,
          match_count: matchCount
        });

      if (error) {
        console.error('❌ Vector search error:', error);
        return [];
      }

      if (!data || data.length === 0) {
        console.log('📊 No KB matches found above threshold', matchThreshold);
        return [];
      }

      console.log(`✅ Found ${data.length} KB matches (${(data[0].similarity * 100).toFixed(1)}% top similarity)`);

      // Format results for user display
      return data.map(result => ({
        id: result.id,
        question: result.question,
        answer: result.answer,
        category: result.category,
        similarity: result.similarity,
        confidence: result.similarity >= 0.85 ? 'high' : result.similarity >= 0.7 ? 'medium' : 'low'
      }));

    } catch (error) {
      console.error('❌ Error in searchForUsers:', error.message);
      // Return empty array to allow fallback to AI
      return [];
    }
  }

  /**
   * Search knowledge base for AI context injection
   * Lower threshold, returns more results for AI to use as context
   * Reduces token usage from ~1,200 tokens (full KB) to 150-300 tokens (relevant entries)
   *
   * @param {string} query - User's question
   * @param {number} matchCount - Number of relevant entries to return, default 5
   * @returns {Promise<Array>} Array of relevant KB entries for AI context
   */
  async searchForAI(query, matchCount = 5) {
    try {
      // Generate query embedding
      const queryEmbedding = await this._generateEmbedding(query);

      // Use lower threshold for AI context (more permissive)
      const { data, error } = await this.supabase
        .schema(this.knowledgeBaseSchema)
        .rpc('match_knowledge', {
          query_embedding: queryEmbedding,
          match_threshold: 0.5, // Lower threshold for context
          match_count: matchCount
        });

      if (error) {
        console.error('❌ Vector search error:', error);
        return [];
      }

      if (!data || data.length === 0) {
        console.log('📊 No KB context found for AI');
        return [];
      }

      console.log(`✅ Found ${data.length} KB entries for AI context`);

      // Return formatted results for AI prompt injection
      return data.map(result => ({
        question: result.question,
        answer: result.answer,
        category: result.category,
        similarity: result.similarity
      }));

    } catch (error) {
      console.error('❌ Error in searchForAI:', error.message);
      // Return empty array to allow AI to proceed without KB context
      return [];
    }
  }

  /**
   * Record user feedback on KB entry usefulness
   * Tracks helpful/not_helpful counts for continuous improvement
   *
   * @param {string} entryId - UUID of the KB entry
   * @param {boolean} isHelpful - true for helpful (👍), false for not helpful (👎)
   * @returns {Promise<boolean>} Success status
   */
  async recordFeedback(entryId, isHelpful) {
    try {
      const columnToUpdate = isHelpful ? 'helpful_count' : 'not_helpful_count';

      // Increment the appropriate counter
      const { error } = await this.supabase
        .schema(this.knowledgeBaseSchema)
        .rpc('increment', {
          row_id: entryId,
          column_name: columnToUpdate
        });

      if (error) {
        // If RPC doesn't exist, try direct SQL update
        const { data: currentEntry, error: fetchError } = await this.supabase
          .schema(this.knowledgeBaseSchema)
          .from(this.knowledgeBaseTable)
          .select(columnToUpdate)
          .eq('id', entryId)
          .single();

        if (fetchError) {
          console.error('❌ Error fetching entry for feedback:', fetchError);
          return false;
        }

        const newCount = (currentEntry[columnToUpdate] || 0) + 1;
        const { error: updateError } = await this.supabase
          .schema(this.knowledgeBaseSchema)
          .from(this.knowledgeBaseTable)
          .update({ [columnToUpdate]: newCount })
          .eq('id', entryId);

        if (updateError) {
          console.error('❌ Error updating feedback:', updateError);
          return false;
        }
      }

      console.log(`👍 Feedback recorded: ${isHelpful ? 'helpful' : 'not helpful'} for entry ${entryId}`);
      return true;

    } catch (error) {
      console.error('❌ Error in recordFeedback:', error.message);
      return false;
    }
  }
}

module.exports = KnowledgeService;
