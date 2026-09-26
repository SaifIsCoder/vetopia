import { supabase } from '../supabase/client';
import {
  ValidationError,
  ForbiddenError,
  NotFoundError,
  AuthError,
  ApiError,
  normalizeError,
} from '../api/errors';
import {
  ConversationSummary,
  DirectMessage,
  CreateAppointmentConversationResponse,
} from '../../types/message';

export class MessageService {
  /**
   * Retrieves all conversations for the authenticated user (SCR-TAB-004).
   * Backed by PostgreSQL RPC `get_user_conversations` or fallback query.
   */
  public async getUserConversations(): Promise<ConversationSummary[]> {
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      throw new AuthError('Authentication required to view conversations.');
    }

    try {
      const { data, error } = await supabase.rpc('get_user_conversations');

      if (!error && Array.isArray(data)) {
        return data as ConversationSummary[];
      }

      // Fallback direct table query if RPC is unavailable
      const { data: convData, error: convErr } = await supabase
        .from('conversations')
        .select(
          `
          id,
          subject,
          appointment_id,
          created_at,
          last_message_at,
          conversation_participants!inner (
            user_id,
            last_read_at
          )
        `,
        )
        .order('last_message_at', { ascending: false });

      if (convErr) {
        throw this.sanitizeError(convErr);
      }

      if (!convData) return [];

      const summaries: ConversationSummary[] = await Promise.all(
        convData.map(async (c: any) => {
          // Find counterpart
          const { data: participants } = await supabase
            .from('conversation_participants')
            .select('user_id, side')
            .eq('conversation_id', c.id);

          const otherParticipant = participants?.find((p: any) => p.user_id !== user.id);
          let counterpart = null;

          if (otherParticipant) {
            const { data: prof } = await supabase
              .from('profiles')
              .select('id, full_name, avatar_url')
              .eq('id', otherParticipant.user_id)
              .maybeSingle();

            const { data: vetProf } = await supabase
              .from('vet_profiles')
              .select('name, specialty')
              .eq('user_id', otherParticipant.user_id)
              .maybeSingle();

            counterpart = {
              user_id: otherParticipant.user_id,
              name: vetProf?.name || prof?.full_name || 'Vetopia User',
              avatar_url: prof?.avatar_url || null,
              role: (vetProf ? 'vet' : 'pet_parent') as 'vet' | 'pet_parent',
              specialty: vetProf?.specialty || null,
            };
          }

          // Last message
          const { data: lastMsgs } = await supabase
            .from('direct_messages')
            .select('id, body, sender_id, created_at')
            .eq('conversation_id', c.id)
            .order('created_at', { ascending: false })
            .limit(1);

          const lastMsg = lastMsgs && lastMsgs.length > 0 ? lastMsgs[0] : null;

          // Unread count
          const myParticipant = c.conversation_participants?.find(
            (p: any) => p.user_id === user.id,
          );
          const lastRead = myParticipant?.last_read_at || c.created_at;

          const { count } = await supabase
            .from('direct_messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', c.id)
            .neq('sender_id', user.id)
            .gt('created_at', lastRead);

          return {
            id: c.id,
            subject: c.subject,
            appointment_id: c.appointment_id,
            created_at: c.created_at,
            last_message_at: c.last_message_at,
            unread_count: count || 0,
            last_message: lastMsg,
            counterpart,
          };
        }),
      );

      return summaries;
    } catch (err) {
      throw this.sanitizeError(err);
    }
  }

  /**
   * Loads a single conversation summary by its ID.
   */
  public async getConversation(conversationId: string): Promise<ConversationSummary | null> {
    if (!conversationId) {
      throw new ValidationError('Conversation ID is required.');
    }

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      throw new AuthError('Authentication required to view conversation.');
    }

    try {
      const { data: conv, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .maybeSingle();

      if (error) {
        throw this.sanitizeError(error);
      }

      if (!conv) {
        return null;
      }

      // Check counterpart
      const { data: participants } = await supabase
        .from('conversation_participants')
        .select('user_id, last_read_at')
        .eq('conversation_id', conversationId);

      const isMember = participants?.some((p) => p.user_id === user.id);
      if (!isMember) {
        throw new ForbiddenError('You are not an authorized participant in this conversation.');
      }

      const otherParticipant = participants?.find((p) => p.user_id !== user.id);
      let counterpart = null;

      if (otherParticipant) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .eq('id', otherParticipant.user_id)
          .maybeSingle();

        const { data: vetProf } = await supabase
          .from('vet_profiles')
          .select('name, specialty')
          .eq('user_id', otherParticipant.user_id)
          .maybeSingle();

        counterpart = {
          user_id: otherParticipant.user_id,
          name: vetProf?.name || prof?.full_name || 'Vetopia User',
          avatar_url: prof?.avatar_url || null,
          role: (vetProf ? 'vet' : 'pet_parent') as 'vet' | 'pet_parent',
          specialty: vetProf?.specialty || null,
        };
      }

      // Appointment context if linked
      let appointment = null;
      if (conv.appointment_id) {
        const { data: appt } = await supabase
          .from('appointments')
          .select(
            `
            id,
            starts_at,
            status,
            mode,
            pets (name),
            vet_profiles (name)
          `,
          )
          .eq('id', conv.appointment_id)
          .maybeSingle();

        if (appt) {
          appointment = {
            id: appt.id,
            starts_at: appt.starts_at,
            status: appt.status,
            mode: appt.mode,
            pet_name: (appt as any).pets?.name || 'Pet',
            vet_name: (appt as any).vet_profiles?.name || 'Doctor',
          };
        }
      }

      // Last message
      const { data: lastMsgs } = await supabase
        .from('direct_messages')
        .select('id, body, sender_id, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(1);

      const lastMsg = lastMsgs && lastMsgs.length > 0 ? lastMsgs[0] : null;

      const myParticipant = participants?.find((p) => p.user_id === user.id);
      const lastRead = myParticipant?.last_read_at || conv.created_at;

      const { count } = await supabase
        .from('direct_messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', user.id)
        .gt('created_at', lastRead);

      return {
        id: conv.id,
        subject: conv.subject,
        appointment_id: conv.appointment_id,
        created_at: conv.created_at,
        last_message_at: conv.last_message_at,
        unread_count: count || 0,
        last_message: lastMsg,
        counterpart,
        appointment,
      };
    } catch (err) {
      throw this.sanitizeError(err);
    }
  }

  /**
   * Retrieves chronological messages for a conversation (SCR-MSG-001).
   */
  public async getMessages(conversationId: string, limit: number = 100): Promise<DirectMessage[]> {
    if (!conversationId) {
      throw new ValidationError('Conversation ID is required.');
    }

    try {
      const { data, error } = await supabase
        .from('direct_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) {
        throw this.sanitizeError(error);
      }

      return (data || []) as DirectMessage[];
    } catch (err) {
      throw this.sanitizeError(err);
    }
  }

  /**
   * Sends a text message in an authorized conversation (FR-MSG-001).
   * Strictly enforces:
   * - 1..4000 character length constraint
   * - Whitespace trimming
   * - Authenticated sender derivation
   */
  public async sendMessage(conversationId: string, body: string): Promise<DirectMessage> {
    if (!conversationId) {
      throw new ValidationError('Conversation ID is required.');
    }

    const trimmed = (body || '').trim();
    if (!trimmed) {
      throw new ValidationError('Message body cannot be empty.');
    }

    if (trimmed.length > 4000) {
      throw new ValidationError('Message exceeds maximum allowed length of 4,000 characters.');
    }

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      throw new AuthError('Authentication required to send messages.');
    }

    try {
      // 1. Attempt server RPC for atomic insert and participant last_read update
      const { data: rpcData, error: rpcErr } = await supabase.rpc('send_direct_message', {
        p_conversation_id: conversationId,
        p_body: trimmed,
      });

      if (!rpcErr && rpcData) {
        return rpcData as DirectMessage;
      }

      if (rpcErr) {
        const errMsg = rpcErr.message || '';
        if (
          errMsg.includes('UNAUTHENTICATED') ||
          errMsg.includes('FORBIDDEN') ||
          errMsg.includes('VALIDATION_ERROR')
        ) {
          throw this.sanitizeError(rpcErr);
        }
      }

      // 2. Direct table insert fallback protected by RLS
      const { data, error } = await supabase
        .from('direct_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          body: trimmed,
        })
        .select()
        .single();

      if (error) {
        throw this.sanitizeError(error);
      }

      // Advance sender's own last_read_at
      await supabase
        .from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);

      return data as DirectMessage;
    } catch (err) {
      throw this.sanitizeError(err);
    }
  }

  /**
   * Marks all messages in a conversation as read for the active user.
   */
  public async markConversationRead(conversationId: string): Promise<void> {
    if (!conversationId) return;

    try {
      const { error: rpcErr } = await supabase.rpc('mark_conversation_read', {
        p_conversation_id: conversationId,
      });

      if (!rpcErr) return;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await supabase
          .from('conversation_participants')
          .update({ last_read_at: new Date().toISOString() })
          .eq('conversation_id', conversationId)
          .eq('user_id', user.id);
      }
    } catch (err) {
      // Non-fatal background sync error
      console.warn('[MessageService.markConversationRead] Warning:', err);
    }
  }

  /**
   * Gets or creates a 1-to-1 conversation linked to a specific appointment.
   */
  public async getOrCreateAppointmentConversation(
    appointmentId: string,
  ): Promise<CreateAppointmentConversationResponse> {
    if (!appointmentId) {
      throw new ValidationError('Appointment ID is required.');
    }

    try {
      const { data, error } = await supabase.rpc('get_or_create_appointment_conversation', {
        p_appointment_id: appointmentId,
      });

      if (error) {
        throw this.sanitizeError(error);
      }

      return data as CreateAppointmentConversationResponse;
    } catch (err) {
      throw this.sanitizeError(err);
    }
  }

  /**
   * Retrieves overall unread message count for tab badges.
   */
  public async getUnreadMessageCount(): Promise<number> {
    try {
      const { data, error } = await supabase.rpc('get_unread_message_count');

      if (!error && typeof data === 'number') {
        return data;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return 0;

      const { data: participations } = await supabase
        .from('conversation_participants')
        .select('conversation_id, last_read_at')
        .eq('user_id', user.id);

      if (!participations || participations.length === 0) return 0;

      let total = 0;
      for (const p of participations) {
        const { count } = await supabase
          .from('direct_messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', p.conversation_id)
          .neq('sender_id', user.id)
          .gt('created_at', p.last_read_at || '1970-01-01');

        total += count || 0;
      }

      return total;
    } catch (err) {
      console.warn('[MessageService.getUnreadMessageCount] Warning:', err);
      return 0;
    }
  }

  /**
   * Subscribes to real-time new message inserts for a conversation.
   * Returns an unsubscribe function for component unmount cleanup.
   */
  public subscribeToConversationMessages(
    conversationId: string,
    onMessage: (message: DirectMessage) => void,
  ): () => void {
    if (!conversationId) return () => {};

    const channelName = `dm_${conversationId}_${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          if (payload.new && payload.new.id) {
            onMessage(payload.new as DirectMessage);
          }
        },
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn(
            `[MessageService] Realtime channel error for conversation: ${conversationId}`,
          );
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }

  /**
   * Sanitizes database/network errors into structured ApiError instances.
   */
  private sanitizeError(err: unknown): ApiError {
    if (err instanceof ApiError) return err;

    const message = (err as any)?.message || 'An unexpected messaging error occurred.';

    if (message.includes('UNAUTHENTICATED')) {
      return new AuthError('Authentication required.');
    }
    if (message.includes('FORBIDDEN') || message.includes('row-level security')) {
      return new ForbiddenError('You are not authorized to access this conversation.');
    }
    if (message.includes('NOT_FOUND')) {
      return new NotFoundError('Conversation not found.');
    }
    if (message.includes('VALIDATION_ERROR') || message.includes('char_length')) {
      return new ValidationError(message);
    }

    return normalizeError(err);
  }
}

export const messageService = new MessageService();
