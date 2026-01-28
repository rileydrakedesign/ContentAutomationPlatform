"use client";

import { useState, useEffect } from "react";
import { Eye, Trash2, ExternalLink, ChevronDown, ChevronRight } from "lucide-react";

interface NicheAccount {
  id: string;
  x_username: string;
  display_name: string | null;
  follower_count: number | null;
  niche_category: string | null;
  is_active: boolean;
  last_sync_at: string | null;
  created_at: string;
  niche_posts?: { count: number }[];
}

interface NichePost {
  id: string;
  x_post_id: string;
  text_content: string;
  metrics: {
    views?: number;
    likes?: number;
    retweets?: number;
    replies?: number;
  };
  post_timestamp: string | null;
  niche_accounts?: {
    x_username: string;
    display_name: string | null;
  };
}

export function NicheAccountsTab() {
  const [accounts, setAccounts] = useState<NicheAccount[]>([]);
  const [posts, setPosts] = useState<NichePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedAccount, setExpandedAccount] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [accountsRes, postsRes] = await Promise.all([
        fetch("/api/niche-accounts"),
        fetch("/api/niche-posts?limit=100"),
      ]);

      if (accountsRes.ok) {
        const accountsData = await accountsRes.json();
        setAccounts(accountsData);
      }

      if (postsRes.ok) {
        const postsData = await postsRes.json();
        setPosts(postsData);
      }
    } catch (error) {
      console.error("Failed to fetch niche data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDeleteAccount = async (id: string) => {
    if (!confirm("Remove this account? All saved posts from this account will also be removed.")) {
      return;
    }

    try {
      const res = await fetch(`/api/niche-accounts/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setAccounts((prev) => prev.filter((a) => a.id !== id));
        setPosts((prev) => prev.filter((p) => p.niche_accounts?.x_username !== accounts.find(a => a.id === id)?.x_username));
      }
    } catch (error) {
      console.error("Failed to delete account:", error);
    }
  };

  const handleDeletePost = async (id: string) => {
    try {
      const res = await fetch(`/api/niche-posts/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete post:", error);
    }
  };

  const formatNumber = (num: number | undefined | null) => {
    if (num === undefined || num === null) return "-";
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getAccountPosts = (username: string) => {
    return posts.filter((p) => p.niche_accounts?.x_username === username);
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-slate-800 rounded w-48"></div>
        <div className="h-32 bg-slate-800 rounded"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium text-white">Watched Accounts</h3>
            <p className="text-sm text-slate-400 mt-1">
              Accounts you're tracking for pattern inspiration. Add accounts via the Chrome extension.
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-500/10 text-violet-400 rounded-full text-sm">
            <Eye className="w-4 h-4" />
            <span>{accounts.length} accounts</span>
          </div>
        </div>

        {accounts.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
              <Eye className="w-6 h-6 text-slate-500" />
            </div>
            <p className="text-slate-400 mb-2">No accounts being watched yet</p>
            <p className="text-sm text-slate-500">
              Visit a profile on X and click the &quot;Watch&quot; button to start tracking an account.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {accounts.map((account) => {
              const accountPosts = getAccountPosts(account.x_username);
              const isExpanded = expandedAccount === account.id;

              return (
                <div key={account.id} className="border border-slate-700 rounded-lg overflow-hidden">
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-800/50 transition-colors"
                    onClick={() => setExpandedAccount(isExpanded ? null : account.id)}
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">
                            {account.display_name || account.x_username}
                          </span>
                          <span className="text-slate-400 text-sm">@{account.x_username}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                          {account.follower_count && (
                            <span>{formatNumber(account.follower_count)} followers</span>
                          )}
                          <span>{accountPosts.length} saved posts</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={`https://x.com/${account.x_username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteAccount(account.id);
                        }}
                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {isExpanded && accountPosts.length > 0 && (
                    <div className="border-t border-slate-700 bg-slate-800/30">
                      {accountPosts.map((post) => (
                        <div
                          key={post.id}
                          className="p-4 border-b border-slate-700/50 last:border-b-0"
                        >
                          <p className="text-sm text-slate-300 line-clamp-3 mb-2">
                            {post.text_content}
                          </p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 text-xs text-slate-500">
                              <span>{formatNumber(post.metrics?.views)} views</span>
                              <span>{formatNumber(post.metrics?.likes)} likes</span>
                              <span>{formatNumber(post.metrics?.retweets)} RTs</span>
                            </div>
                            <button
                              onClick={() => handleDeletePost(post.id)}
                              className="p-1 text-slate-400 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-slate-900/50 border border-slate-800/50 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-violet-500/10 flex items-center justify-center flex-shrink-0">
            <svg
              className="w-4 h-4 text-violet-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm text-slate-300">
              Posts from watched accounts are analyzed for patterns. Use the{" "}
              <strong className="text-white">Extract Patterns</strong> button on the
              Insights page to discover what works.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
