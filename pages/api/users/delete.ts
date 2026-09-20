import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

interface DeleteUserRequest {
  userId: string;
}

interface DeleteUserResponse {
  success: boolean;
  error?: string;
}

/**
 * User Delete API Route
 * Handles user deletion server-side to avoid CORS issues
 * Deletes from auth.users (which cascades to profiles and related records)
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DeleteUserResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { userId } = req.body as DeleteUserRequest;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }

    console.log('[API deleteUser] Starting deletion for user:', userId);

    // Delete from auth.users - this will cascade delete profiles and related records
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error('[API deleteUser] Error deleting user:', deleteError);
      return res.status(500).json({
        success: false,
        error: `Error al eliminar el usuario: ${deleteError.message}`
      });
    }

    console.log('[API deleteUser] User deleted successfully');
    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('[API deleteUser] Unexpected error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error inesperado al eliminar el usuario'
    });
  }
}
