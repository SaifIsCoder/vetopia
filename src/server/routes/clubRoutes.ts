import { Router } from 'express';
import { getClubPosts, createClubPost, togglePostLike, addPostComment } from '../controllers/clubController';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/authMiddleware';

export const clubRouter = Router();

clubRouter.get('/:clubId/posts', optionalAuthMiddleware, getClubPosts);
clubRouter.post('/posts', authMiddleware, createClubPost);
clubRouter.post('/posts/:id/like', authMiddleware, togglePostLike);
clubRouter.post('/posts/:id/comments', authMiddleware, addPostComment);
