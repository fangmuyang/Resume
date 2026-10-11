import { Link } from 'react-router';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PostMeta } from '@/lib/content';
import { formatYearMonth } from '@/lib/format';

export interface PostCardProps {
  post: PostMeta;
}

export function PostCard({ post }: PostCardProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center gap-3">
          <time
            dateTime={post.date}
            className="font-mono text-xs text-slate-500 dark:text-slate-500"
          >
            {formatYearMonth(post.date)}
          </time>
          <span className="font-mono text-xs text-slate-400 dark:text-slate-600">
            {post.readingMinutes} 分钟
          </span>
        </div>

        <CardTitle>
          <Link
            to={post.slug}
            relative="path"
            className="hover:text-brand-600 dark:hover:text-brand-500 transition-colors"
          >
            {post.title}
          </Link>
        </CardTitle>
      </CardHeader>

      <CardContent className="grid gap-3">
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{post.summary}</p>

        <div className="flex flex-wrap gap-1.5">
          {post.tags.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
