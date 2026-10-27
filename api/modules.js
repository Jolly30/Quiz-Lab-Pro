import { supabaseAdmin } from './supabase-admin.js';

async function getUser(req) {
  const token = req.headers['x-session-token'];
  if (!token) return null;
  try {
    const { data } = await supabaseAdmin
      .from('sessions')
      .select('user_id, email')
      .eq('token', token)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .single();
    return data ?? null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  const user = await getUser(req);
  if (!user || !user.user_id) {
    return res.status(401).json({ error: 'Unauthorized: valid session required' });
  }

  const userIds = [user.user_id, user.email].filter(Boolean);

  try {
    // GET: List all modules for user (matches Google ID or Email)
    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('modules')
        .select('display_name, content, folder_name, updated_at')
        .in('user_id', userIds);

      if (error) {
        console.error('Error fetching modules:', error);
        return res.status(500).json({ error: error.message });
      }

      // De-duplicate if same module exists for both user_id and email
      const uniqueModulesMap = new Map();
      (data || []).forEach(row => {
        if (!uniqueModulesMap.has(row.display_name)) {
          uniqueModulesMap.set(row.display_name, row);
        }
      });

      return res.status(200).json(Array.from(uniqueModulesMap.values()));
    }

    // POST: Upsert single module
    if (req.method === 'POST') {
      const { display_name, content, folder_name } = req.body;
      if (!display_name) {
        return res.status(400).json({ error: 'display_name is required' });
      }

      const stringContent = typeof content === 'string' ? content : JSON.stringify(content || []);

      // Upsert for primary user_id
      const { error } = await supabaseAdmin
        .from('modules')
        .upsert({
          user_id: user.user_id,
          display_name,
          content: stringContent,
          folder_name: folder_name || 'Saved Modules',
          updated_at: Date.now()
        }, { onConflict: 'user_id,display_name' });

      if (error) {
        console.error('Error saving module:', error);
        return res.status(500).json({ error: error.message });
      }

      // If user also has an email, upsert for email as well for cross-compatibility
      if (user.email && user.email !== user.user_id) {
        await supabaseAdmin.from('modules').upsert({
          user_id: user.email,
          display_name,
          content: stringContent,
          folder_name: folder_name || 'Saved Modules',
          updated_at: Date.now()
        }, { onConflict: 'user_id,display_name' }).catch(() => {});
      }

      return res.status(200).json({ ok: true });
    }

    // DELETE: Delete single module or multiple modules
    if (req.method === 'DELETE') {
      const { display_name, modules } = req.body;

      if (Array.isArray(modules) && modules.length > 0) {
        const { error } = await supabaseAdmin
          .from('modules')
          .delete()
          .in('user_id', userIds)
          .in('display_name', modules);

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ ok: true, deleted: modules.length });
      }

      if (display_name) {
        const { error } = await supabaseAdmin
          .from('modules')
          .delete()
          .in('user_id', userIds)
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
        let moduleContent = content;
        let moduleFolder = folder_name;
        if (!moduleContent) {
          const { data: existing } = await supabaseAdmin
            .from('modules')
            .select('content, folder_name')
            .in('user_id', userIds)
            .eq('display_name', old_name)
            .limit(1)
            .single();
          moduleContent = existing?.content || '[]';
          moduleFolder = moduleFolder || existing?.folder_name || 'Saved Modules';
        }

        const stringContent = typeof moduleContent === 'string' ? moduleContent : JSON.stringify(moduleContent);

        for (const targetId of userIds) {
          await supabaseAdmin
            .from('modules')
            .upsert({
              user_id: targetId,
              display_name: new_name,
              content: stringContent,
              folder_name: moduleFolder || 'Saved Modules',
              updated_at: Date.now()
            }, { onConflict: 'user_id,display_name' });

          await supabaseAdmin
            .from('modules')
            .delete()
            .eq('user_id', targetId)
            .eq('display_name', old_name);
        }

        return res.status(200).json({ ok: true });
      }

      // Case 2: Rename folder for a list of modules
      if (folder_name && Array.isArray(modules) && modules.length > 0) {
        const { error } = await supabaseAdmin
          .from('modules')
          .update({ folder_name, updated_at: Date.now() })
          .in('user_id', userIds)
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
