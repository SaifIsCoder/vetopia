-- POSTS
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  caption text not null default '',
  category text not null default 'general',
  location text,
  pet_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.posts to anon;
grant select, insert, update, delete on public.posts to authenticated;
grant all on public.posts to service_role;
alter table public.posts enable row level security;
create policy "posts are publicly viewable" on public.posts for select using (true);
create policy "author creates own posts" on public.posts for insert to authenticated with check (author_id = auth.uid());
create policy "author updates own posts" on public.posts for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "author deletes own posts" on public.posts for delete to authenticated using (author_id = auth.uid());
create trigger posts_set_updated_at before update on public.posts for each row execute function public.set_updated_at();
create index posts_author_created_idx on public.posts (author_id, created_at desc);
create index posts_created_idx on public.posts (created_at desc);
create index posts_category_idx on public.posts (category);

-- MEDIA
create table public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  url text not null,
  kind text not null default 'image',
  position integer not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.post_media to anon;
grant select, insert, update, delete on public.post_media to authenticated;
grant all on public.post_media to service_role;
alter table public.post_media enable row level security;
create policy "post media is publicly viewable" on public.post_media for select using (true);
create policy "author adds own post media" on public.post_media for insert to authenticated
  with check (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));
create policy "author deletes own post media" on public.post_media for delete to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));
create index post_media_post_idx on public.post_media (post_id, position);

-- COMMENTS
create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.post_comments(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
grant select on public.post_comments to anon;
grant select, insert, delete on public.post_comments to authenticated;
grant all on public.post_comments to service_role;
alter table public.post_comments enable row level security;
create policy "comments are publicly viewable" on public.post_comments for select using (true);
create policy "members comment" on public.post_comments for insert to authenticated with check (user_id = auth.uid());
create policy "members delete own comments" on public.post_comments for delete to authenticated using (user_id = auth.uid());
create index post_comments_post_idx on public.post_comments (post_id, created_at);

-- LIKES
create table public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
grant select on public.post_likes to anon;
grant select, insert, delete on public.post_likes to authenticated;
grant all on public.post_likes to service_role;
alter table public.post_likes enable row level security;
create policy "likes are publicly viewable" on public.post_likes for select using (true);
create policy "members like posts" on public.post_likes for insert to authenticated with check (user_id = auth.uid());
create policy "members unlike posts" on public.post_likes for delete to authenticated using (user_id = auth.uid());

-- SAVES
create table public.post_saves (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
grant select, insert, delete on public.post_saves to authenticated;
grant all on public.post_saves to service_role;
alter table public.post_saves enable row level security;
create policy "members read own saves" on public.post_saves for select to authenticated using (user_id = auth.uid());
create policy "members save posts" on public.post_saves for insert to authenticated with check (user_id = auth.uid());
create policy "members unsave posts" on public.post_saves for delete to authenticated using (user_id = auth.uid());

-- FOLLOWS
create table public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint no_self_follow check (follower_id <> following_id)
);
grant select on public.follows to anon;
grant select, insert, delete on public.follows to authenticated;
grant all on public.follows to service_role;
alter table public.follows enable row level security;
create policy "follows are publicly viewable" on public.follows for select using (true);
create policy "members follow others" on public.follows for insert to authenticated with check (follower_id = auth.uid());
create policy "members unfollow others" on public.follows for delete to authenticated using (follower_id = auth.uid());
create index follows_following_idx on public.follows (following_id);