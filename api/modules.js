import { supabaseAdmin } from './supabase-admin.js';

async function getUser(req) {
  const token = req.headers['x-session-token'];
  if (!token) return null;
  try {
    const { data } = await supabaseAdmin
      .from('sessions')
      .select('user_id')
      .eq('token', token)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .single();
    return data?.user_id ?? null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  const userId = await getUser(req);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: valid session required' });
  }

  try {
    // GET: List all modules for user
    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('modules')
        .select('display_name, content, folder_name, updated_at')
        .eq('user_id', userId);

      if (error) {
        console.error('Error fetching modules:', error);
        return res.status(500).json({ error: error.message });
      }
      return res.status(200).json(data || []);
    }

    // POST: Upsert single module
    if (req.method === 'POST') {
      const { display_name, content, folder_name } = req.body;
      if (!display_name) {
        return res.status(400).json({ error: 'display_name is required' });
      }

      const { error } = await supabaseAdmin
        .from('modules')
        .upsert({
          user_id: userId,
          display_name,
          content: typeof content === 'string' ? content : JSON.stringify(content || []),
          folder_name: folder_name || 'Saved Modules',
          updated_at: Date.now()
        }, { onConflict: 'user_id,display_name' });

      if (error) {
        console.error('Error saving module:', error);
        return res.status(500).json({ error: error.message });
      }
      return res.status(200).json({ ok: true });
    }

    // DELETE: Delete single module or multiple modules
    if (req.method === 'DELETE') {
      const { display_name, modules } = req.body;

      if (Array.isArray(modules) && modules.length > 0) {
        // Delete multiple modules (e.g. folder deletion)
        const { error } = await supabaseAdmin
          .from('modules')
          .delete()
          .eq('user_id', userId)
          .in('display_name', modules);

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ ok: true, deleted: modules.length });
      }

      if (display_name) {
        const { error } = await supabaseAdmin
          .from('modules')
          .delete()
          .eq('user_id', userId)
          .eq('display_name', display_name);

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ error: 'display_name or modules array required' });
    }

    // PUT: Rename module or rename folder
    if (req.method === 'PUT') {
      const { old_name, new_name, folder_name, modules, content } = req.body;

      // Case 1: Rename module
      if (old_name && new_name) {
        // Fetch existing content if not provided
        let moduleContent = content;
        let moduleFolder = folder_name;
        if (!moduleContent) {
          const { data: existing } = await supabaseAdmin
            .from('modules')
            .select('content, folder_name')
            .eq('user_id', userId)
            .eq('display_name', old_name)
            .single();
          moduleContent = existing?.content || '[]';
          moduleFolder = moduleFolder || existing?.folder_name || 'Saved Modules';
        }

        // Upsert new name
        const { error: upsertErr } = await supabaseAdmin
          .from('modules')
          .upsert({
            user_id: userId,
            display_name: new_name,
            content: typeof moduleContent === 'string' ? moduleContent : JSON.stringify(moduleContent),
            folder_name: moduleFolder || 'Saved Modules',
            updated_at: Date.now()
          }, { onConflict: 'user_id,display_name' });

        if (upsertErr) return res.status(500).json({ error: upsertErr.message });

        // Delete old name
        await supabaseAdmin
          .from('modules')
          .delete()
          .eq('user_id', userId)
          .eq('display_name', old_name);

        return res.status(200).json({ ok: true });
      }

      // Case 2: Rename folder for a list of modules
      if (folder_name && Array.isArray(modules) && modules.length > 0) {
        const { error } = await supabaseAdmin
          .from('modules')
          .update({ folder_name, updated_at: Date.now() })
          .eq('user_id', userId)
          .in('display_name', modules);

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ ok: true, updated: modules.length });
      }

      return res.status(400).json({ error: 'Invalid update parameters' });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err) {
    console.error('Modules API fatal error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
