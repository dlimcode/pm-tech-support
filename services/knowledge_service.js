// KnowledgeService - Handles all knowledge base operations
// Extracted from server.js as part of Phase 1 refactoring

const fs = require('fs');
const path = require('path');

class KnowledgeService {
  constructor(supabaseClient, knowledgeBasePath = null) {
    if (!supabaseClient) {
      throw new Error('KnowledgeService requires a Supabase client');
    }

    this.supabase = supabaseClient;
    this.knowledgeBasePath = knowledgeBasePath || path.join(__dirname, '..', 'knowledge-base.md');
    this.knowledgeBaseTable = 'knowledge_base';
    this.knowledgeBaseContent = '';
    this.initialized = false;

    // Initial load of static knowledge base
    this._loadStaticKnowledgeBase();

    // Watch for file changes in development
    if (process.env.NODE_ENV !== 'production') {
      fs.watchFile(this.knowledgeBasePath, (curr, prev) => {
        console.log('=Ý Knowledge base file changed, reloading...');
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
      console.log('=Ú Knowledge base loaded/reloaded');
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

      console.log('=Ú Knowledge base table check:', error ? 'Using file fallback' : 'Database ready');
    } catch (error) {
      console.log('=Ú Knowledge base: Using file-based fallback');
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
        console.log('  Database query failed, using static knowledge base only:', error.message);
        console.log('= Error code:', error.code);
        console.log('=' Environment:', process.env.VERCEL ? 'Vercel' : 'Local');
        console.log('=' Supabase URL:', process.env.SUPABASE_URL ? 'Set (' + process.env.SUPABASE_URL.substring(0, 30) + '...)' : 'MISSING');
        console.log('=' Supabase key:', process.env.SUPABASE_ANON_KEY ? 'Set (' + process.env.SUPABASE_ANON_KEY.substring(0, 20) + '...)' : 'MISSING');

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
          console.log('=Ä Table does not exist - check schema and table name');
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

          console.log('=Ú Knowledge base loaded: Static content + ' + data.length + ' dynamic entries from database');
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

          console.log('=Ú Knowledge base loaded: Static content + ' + data.length + ' dynamic entries (appended)');
        }
      } else {
        console.log('=Ú Knowledge base loaded: Static content only (no database entries)');
      }

      this.knowledgeBaseContent = knowledgeBase;
      this.initialized = true; // Mark as initialized when successful
      return knowledgeBase;

    } catch (error) {
      console.error('L Error loading from database, using static knowledge base only:', error);
      // Fallback to just the static file content
      const staticKnowledgeBase = this._loadStaticKnowledgeBase();
      console.log('=Ú Knowledge base loaded: Static content only (database error fallback)');
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
        console.log('  Database insert failed:', error.message);
        console.log('= Error details:', JSON.stringify(error, null, 2));
        console.log('=' Environment check:');
        console.log('   - SUPABASE_URL:', process.env.SUPABASE_URL ? 'Set' : 'Missing');
        console.log('   - SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'Set' : 'Missing');
        console.log('   - VERCEL environment:', process.env.VERCEL ? 'Yes' : 'No');

        // Check if it's a permission issue
        if (error.code === '42501' || error.message.includes('permission denied')) {
          console.log('= Permission denied - RLS policies may need to be configured');
          console.log('=¡ Check fix-rls-policies.sql for SQL commands to fix this');
        }

        // Don't fallback to file updates in production (Vercel)
        if (process.env.VERCEL) {
          console.log('L Cannot fallback to file updates in Vercel deployment');
          return false;
        }

        // Fallback to file update for local development only
        console.log('= Falling back to file-based knowledge base update...');
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
      console.log('=Ú Knowledge base updated with new Q&A:', qaPair.question);

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
}

module.exports = KnowledgeService;
