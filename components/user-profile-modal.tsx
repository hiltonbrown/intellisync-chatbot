'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { UserIcon, CpuIcon, LogsIcon } from './icons';
import { useTheme } from 'next-themes';

interface UserProfileModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  user?: {
    name?: string;
    email?: string;
    avatar?: string;
  };
}

export function UserProfileModal({
  isOpen,
  onOpenChange,
  user,
}: UserProfileModalProps) {
  const { theme, setTheme } = useTheme();
  const [name, setName] = React.useState(user?.name || '');
  const [email, setEmail] = React.useState(user?.email || '');
  const [isEditing, setIsEditing] = React.useState(false);

  const handleSave = () => {
    // TODO: Implement save functionality
    setIsEditing(false);
  };

  const handleLogout = () => {
    // TODO: Implement logout functionality
    console.log('Logout clicked');
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={() => onOpenChange(false)}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative mx-4 w-full max-w-md rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold text-lg">
              <UserIcon />
              Profile & Settings
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 p-0"
            >
              ×
            </Button>
          </div>

          <div className="space-y-6">
            {/* Profile Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={user?.avatar} />
                    <AvatarFallback className="bg-[#0FA47F] text-lg text-white">
                      {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="flex-1">
                  {isEditing ? (
                    <div className="space-y-2">
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your name"
                        className="text-sm"
                      />
                      <Input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your.email@example.com"
                        className="text-sm"
                        type="email"
                      />
                    </div>
                  ) : (
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {user?.name || 'User'}
                      </h3>
                      <p className="text-gray-500 text-sm">
                        {user?.email || 'user@example.com'}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <Button
                      size="sm"
                      onClick={handleSave}
                      className="bg-[#0FA47F] hover:bg-[#0FA47F]/90"
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsEditing(false)}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsEditing(true)}
                  >
                    Edit Profile
                  </Button>
                )}
              </div>
            </div>

            <Separator />

            {/* Theme Settings */}
            <div className="space-y-3">
              <Label className="font-medium text-gray-700 text-sm">Theme</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={theme === 'light' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTheme('light')}
                  className="flex items-center gap-2"
                >
                  Light
                </Button>
                <Button
                  variant={theme === 'dark' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTheme('dark')}
                  className="flex items-center gap-2"
                >
                  Dark
                </Button>
                <Button
                  variant={theme === 'system' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTheme('system')}
                  className="flex items-center gap-2"
                >
                  System
                </Button>
              </div>
            </div>

            <Separator />

            {/* Additional Settings */}
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start"
                size="sm"
              >
                <div className="mr-2">
                  <CpuIcon />
                </div>
                Advanced Settings
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                size="sm"
              >
                <div className="mr-2">
                  <UserIcon />
                </div>
                Account Settings
              </Button>
            </div>

            <Separator />

            {/* Logout */}
            <Button
              variant="outline"
              className="w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={handleLogout}
            >
              <div className="mr-2">
                <LogsIcon />
              </div>
              Sign Out
            </Button>

            {/* Version Info */}
            <div className="border-t pt-4 text-center text-gray-500 text-xs">
              Chatbot v1.0.0
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
