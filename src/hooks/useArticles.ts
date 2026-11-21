/**
 * React Query Hooks for Educational Blog Articles (M4)
 * Provides cached data fetching, optimistic mutation updates, and error states.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { articleService } from '../lib/articles/articleService';
import {
  ArticleStatus,
  CreateArticleDTO,
  UpdateArticleDTO,
} from '../types/article';

export const ARTICLE_QUERY_KEYS = {
  all: (search?: string, category?: string, status?: ArticleStatus) =>
    ['articles', search || 'all', category || 'all', status || 'published'] as const,
  detail: (idOrSlug: string) => ['article', idOrSlug] as const,
  myArticles: ['my-articles'] as const,
};

/**
 * Hook to retrieve published articles with search and category filtering
 */
export function useArticles(
  searchQuery?: string,
  category?: string,
  status: ArticleStatus = 'published',
) {
  return useQuery({
    queryKey: ARTICLE_QUERY_KEYS.all(searchQuery, category, status),
    queryFn: () => articleService.getArticles(searchQuery, category, status),
    staleTime: 1000 * 60 * 3, // 3 minutes
  });
}

/**
 * Hook to retrieve single article by UUID or slug
 */
export function useArticle(idOrSlug: string) {
  return useQuery({
    queryKey: ARTICLE_QUERY_KEYS.detail(idOrSlug),
    queryFn: () => articleService.getArticleByIdOrSlug(idOrSlug),
    enabled: Boolean(idOrSlug),
  });
}

/**
 * Hook to retrieve articles authored by the current user
 */
export function useMyArticles() {
  return useQuery({
    queryKey: ARTICLE_QUERY_KEYS.myArticles,
    queryFn: () => articleService.getMyArticles(),
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Hook to create a new educational article
 */
export function useCreateArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateArticleDTO) => articleService.createArticle(input),
    onSuccess: (article) => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      queryClient.invalidateQueries({ queryKey: ARTICLE_QUERY_KEYS.myArticles });
      if (article.slug) {
        queryClient.setQueryData(ARTICLE_QUERY_KEYS.detail(article.slug), article);
      }
      queryClient.setQueryData(ARTICLE_QUERY_KEYS.detail(article.id), article);
    },
  });
}

/**
 * Hook to update an existing article
 */
export function useUpdateArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      articleId,
      input,
    }: {
      articleId: string;
      input: UpdateArticleDTO;
    }) => articleService.updateArticle(articleId, input),
    onSuccess: (article) => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      queryClient.invalidateQueries({ queryKey: ARTICLE_QUERY_KEYS.myArticles });
      queryClient.invalidateQueries({ queryKey: ARTICLE_QUERY_KEYS.detail(article.id) });
      if (article.slug) {
        queryClient.invalidateQueries({ queryKey: ARTICLE_QUERY_KEYS.detail(article.slug) });
      }
    },
  });
}

/**
 * Hook to delete an article
 */
export function useDeleteArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (articleId: string) => articleService.deleteArticle(articleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      queryClient.invalidateQueries({ queryKey: ARTICLE_QUERY_KEYS.myArticles });
    },
  });
}
