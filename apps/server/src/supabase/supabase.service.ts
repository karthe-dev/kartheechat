import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  public client: SupabaseClient;

  constructor() {
    this.client = createClient(
      process.env.SUPABASE_URL || 'https://qeuliasbqwpftcyjlqbt.supabase.co',
      process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFldWxpYXNicXdwZnRjeWpscWJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njg1NTk2MiwiZXhwIjoyMDkyNDMxOTYyfQ.HXb93-zGR57cTZLJagPBtLhVqNptvb5CUS2mgLlB0ag',
    );
  }
}
