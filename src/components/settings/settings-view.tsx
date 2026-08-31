'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { USER_ROLE_LABELS } from '@/lib/constants';
import { getInitials } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Eye, EyeOff, Save, Shield } from 'lucide-react';

interface SettingsViewProps {
  onProfileUpdate?: (user: any) => void;
}

export function SettingsView({ onProfileUpdate }: SettingsViewProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get('/api/auth/profile'),
  });

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setPhone(profile.phone || '');
    }
  }, [profile]);

  const profileMutation = useMutation({
    mutationFn: (data: { name: string; phone: string }) => api.put('/api/auth/profile', data),
    onSuccess: (updatedProfile) => {
      toast.success('Profile updated successfully');
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      // Update the user in api client and parent
      const user = api.getUser();
      const merged = { ...(user || {}), name: updatedProfile.name, phone: updatedProfile.phone };
      api.setUser(merged);
      onProfileUpdate?.(updatedProfile);
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to update profile'),
  });

  const passwordMutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
      api.post('/api/auth/change-password', data),
    onSuccess: () => {
      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to change password'),
  });

  const handleProfileSave = (e: React.FormEvent) => {
    e.preventDefault();
    profileMutation.mutate({ name, phone });
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      toast.error('Password must contain uppercase, lowercase, and a number');
      return;
    }
    passwordMutation.mutate({ currentPassword, newPassword, confirmPassword });
  };

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-12'>
        <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
      </div>
    );
  }

  const isAdmin = profile?.role === 'ADMIN';

  return (
    <div className='max-w-3xl mx-auto space-y-6'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Settings</h1>
        <p className='text-sm text-muted-foreground'>Manage your account settings and security</p>
      </div>

      <Tabs defaultValue='profile' className='w-full'>
        <TabsList className='grid w-full grid-cols-2'>
          <TabsTrigger value='profile'>Profile Information</TabsTrigger>
          <TabsTrigger value='security'>Security</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value='profile' className='space-y-6'>
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>View and update your personal information</CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              {/* Avatar Section */}
              <div className='flex items-center gap-4'>
                <Avatar className='h-20 w-20'>
                  <AvatarFallback className='text-xl bg-primary/10 text-primary font-bold'>
                    {getInitials(profile?.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className='text-lg font-semibold'>{profile?.name || 'No name set'}</h3>
                  <p className='text-sm text-muted-foreground'>{profile?.email}</p>
                  <Badge variant={isAdmin ? 'default' : 'secondary'} className='mt-1'>
                    {USER_ROLE_LABELS[profile?.role] || profile?.role}
                  </Badge>
                </div>
              </div>

              <Separator />

              <form onSubmit={handleProfileSave} className='space-y-4'>
                <div className='grid gap-4 sm:grid-cols-2'>
                  <div className='space-y-1.5'>
                    <Label htmlFor='settings-name'>Full Name</Label>
                    <Input
                      id='settings-name'
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder='Enter your full name'
                    />
                  </div>
                  <div className='space-y-1.5'>
                    <Label htmlFor='settings-email'>Email Address</Label>
                    <Input
                      id='settings-email'
                      value={profile?.email || ''}
                      disabled
                      className='bg-muted'
                    />
                    <p className='text-xs text-muted-foreground'>Email cannot be changed</p>
                  </div>
                </div>

                <div className='grid gap-4 sm:grid-cols-2'>
                  <div className='space-y-1.5'>
                    <Label htmlFor='settings-phone'>Phone Number</Label>
                    <Input
                      id='settings-phone'
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder='+1 (555) 000-0000'
                    />
                  </div>
                  <div className='space-y-1.5'>
                    <Label>Role</Label>
                    <Input
                      value={USER_ROLE_LABELS[profile?.role] || profile?.role || ''}
                      disabled
                      className='bg-muted'
                    />
                    <p className='text-xs text-muted-foreground'>Role is assigned by administrator</p>
                  </div>
                </div>

                <div className='flex justify-end'>
                  <Button type='submit' disabled={profileMutation.isPending}>
                    {profileMutation.isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                    <Save className='mr-2 h-4 w-4' /> Save Changes
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value='security' className='space-y-6'>
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Shield className='h-5 w-5' /> Change Password
              </CardTitle>
              <CardDescription>
                Update your password to keep your account secure. Use a strong password with uppercase, lowercase, and numbers.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className='space-y-4 max-w-md'>
                <div className='space-y-1.5'>
                  <Label htmlFor='current-pw'>Current Password</Label>
                  <div className='relative'>
                    <Input
                      id='current-pw'
                      type={showCurrentPw ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder='Enter current password'
                      required
                    />
                    <button
                      type='button'
                      className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
                      onClick={() => setShowCurrentPw(!showCurrentPw)}
                    >
                      {showCurrentPw ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
                    </button>
                  </div>
                </div>

                <div className='space-y-1.5'>
                  <Label htmlFor='new-pw'>New Password</Label>
                  <div className='relative'>
                    <Input
                      id='new-pw'
                      type={showNewPw ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder='Min 8 chars, uppercase, lowercase, number'
                      required
                    />
                    <button
                      type='button'
                      className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
                      onClick={() => setShowNewPw(!showNewPw)}
                    >
                      {showNewPw ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
                    </button>
                  </div>
                </div>

                <div className='space-y-1.5'>
                  <Label htmlFor='confirm-pw'>Confirm New Password</Label>
                  <Input
                    id='confirm-pw'
                    type='password'
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder='Confirm new password'
                    required
                  />
                </div>

                <div className='flex justify-end pt-2'>
                  <Button type='submit' disabled={passwordMutation.isPending}>
                    {passwordMutation.isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                    Update Password
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
