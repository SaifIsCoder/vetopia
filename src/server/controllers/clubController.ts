import { Request, Response } from 'express';
import { supabaseAdmin } from '../supabase';

export async function getClubPosts(req: Request, res: Response) {
  try {
    const { clubId } = req.params;
    let query = supabaseAdmin
      .from('posts')
      .select('*, author:profiles!posts_author_id_fkey(full_name, avatar_url, role)')
      .neq('status', 'removed')
      .order('created_at', { ascending: false })
      .limit(50);

    if (clubId && clubId !== 'all') {
      query = query.eq('club_id', clubId);
    }

    const { data: posts, error } = await query;
    if (error) {
      // If foreign key relationship fails or profiles join isn't set up, try simple select
      const { data: simplePosts, error: simpleError } = await supabaseAdmin
        .from('posts')
        .select('*')
        .neq('status', 'removed')
        .order('created_at', { ascending: false })
        .limit(50);

      if (simpleError) {
        return res.status(500).json({
          success: false,
          error: { message: simpleError.message, code: 'DATABASE_ERROR' },
        });
      }

      const formatted = (simplePosts || []).map((p: any) => ({
        id: p.id,
        _id: p.id,
        authorId: p.author_id,
        authorName: 'Pet Parent',
        authorAvatar: null,
        authorRole: 'owner',
        clubId: p.club_id,
        content: p.content || p.caption || '',
        mediaUrls: p.image_url ? [p.image_url] : [],
        likesCount: p.likes_count || 0,
        likedBy: [],
        commentsCount: p.comments_count || 0,
        comments: [],
        createdAt: p.created_at,
      }));

      return res.status(200).json({ success: true, data: formatted });
    }

    const formatted = (posts || []).map((p: any) => ({
      id: p.id,
      _id: p.id,
      authorId: p.author_id,
      authorName: p.author?.full_name || 'Pet Parent',
      authorAvatar: p.author?.avatar_url || null,
      authorRole: p.author?.role || 'owner',
      clubId: p.club_id,
      content: p.content || p.caption || '',
      mediaUrls: p.image_url ? [p.image_url] : [],
      likesCount: p.likes_count || 0,
      likedBy: [],
      commentsCount: p.comments_count || 0,
      comments: [],
      createdAt: p.created_at,
    }));

    return res.status(200).json({ success: true, data: formatted });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { message: err?.message || 'Failed to fetch posts.', code: 'SERVER_ERROR' },
    });
  }
}

export async function createClubPost(req: Request, res: Response) {
  try {
    const authorId = req.user?.id || req.body.authorId;
    const authorName = req.body.authorName || 'Pet Parent';
    const { clubId, content, mediaUrls, authorRole, authorAvatar } = req.body;

    if (!authorId || !clubId || !content) {
      return res.status(400).json({
        success: false,
        error: { message: 'authorId, clubId, and content are required.', code: 'VALIDATION_ERROR' },
      });
    }

    const firstImage = Array.isArray(mediaUrls) && mediaUrls.length > 0 ? mediaUrls[0] : null;

    const { data: post, error } = await supabaseAdmin
      .from('posts')
      .insert({
        author_id: authorId,
        club_id: clubId,
        content,
        caption: content.slice(0, 100),
        image_url: firstImage,
        likes_count: 0,
        comments_count: 0,
        status: 'approved',
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'DATABASE_ERROR' },
      });
    }

    const formatted = {
      id: post.id,
      _id: post.id,
      authorId: post.author_id,
      authorName,
      authorAvatar: authorAvatar || null,
      authorRole: authorRole || 'owner',
      clubId: post.club_id,
      content: post.content,
      mediaUrls: Array.isArray(mediaUrls) ? mediaUrls : [],
      likesCount: 0,
      likedBy: [],
      sharesCount: 0,
      commentsCount: 0,
      comments: [],
      createdAt: post.created_at,
    };

    return res.status(201).json({ success: true, data: formatted });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { message: err?.message || 'Failed to create post.', code: 'SERVER_ERROR' },
    });
  }
}

export async function togglePostLike(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.body.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: { message: 'userId is required to like post.', code: 'VALIDATION_ERROR' },
      });
    }

    // Check if liked
    const { data: existingLike } = await supabaseAdmin
      .from('post_likes')
      .select('*')
      .eq('post_id', id)
      .eq('user_id', userId)
      .maybeSingle();

    const hasLiked = !!existingLike;

    if (hasLiked) {
      await supabaseAdmin
        .from('post_likes')
        .delete()
        .eq('post_id', id)
        .eq('user_id', userId);

      // Decrement count
      const { data: post } = await supabaseAdmin
        .from('posts')
        .select('likes_count')
        .eq('id', id)
        .maybeSingle();

      const newCount = Math.max(0, (post?.likes_count || 1) - 1);
      await supabaseAdmin.from('posts').update({ likes_count: newCount }).eq('id', id);

      return res.status(200).json({
        success: true,
        data: { liked: false, likesCount: newCount },
      });
    } else {
      await supabaseAdmin
        .from('post_likes')
        .insert({ post_id: id, user_id: userId });

      // Increment count
      const { data: post } = await supabaseAdmin
        .from('posts')
        .select('likes_count')
        .eq('id', id)
        .maybeSingle();

      const newCount = (post?.likes_count || 0) + 1;
      await supabaseAdmin.from('posts').update({ likes_count: newCount }).eq('id', id);

      return res.status(200).json({
        success: true,
        data: { liked: true, likesCount: newCount },
      });
    }
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { message: err?.message || 'Failed to toggle like.', code: 'SERVER_ERROR' },
    });
  }
}

export async function addPostComment(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const authorId = req.user?.id || req.body.authorId;
    const authorName = req.body.authorName || 'Pet Parent';
    const { content, authorAvatar } = req.body;

    if (!authorId || !content) {
      return res.status(400).json({
        success: false,
        error: { message: 'authorId and content are required.', code: 'VALIDATION_ERROR' },
      });
    }

    const { data: comment, error } = await supabaseAdmin
      .from('post_comments')
      .insert({
        post_id: id,
        user_id: authorId,
        body: content,
        status: 'approved',
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'DATABASE_ERROR' },
      });
    }

    // Increment comments count
    const { data: post } = await supabaseAdmin
      .from('posts')
      .select('comments_count')
      .eq('id', id)
      .maybeSingle();

    const newCommentsCount = (post?.comments_count || 0) + 1;
    await supabaseAdmin.from('posts').update({ comments_count: newCommentsCount }).eq('id', id);

    return res.status(200).json({
      success: true,
      data: {
        id: comment.id,
        postId: id,
        authorId,
        authorName,
        authorAvatar: authorAvatar || null,
        content: comment.body,
        createdAt: comment.created_at,
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { message: err?.message || 'Failed to add comment.', code: 'SERVER_ERROR' },
    });
  }
}
