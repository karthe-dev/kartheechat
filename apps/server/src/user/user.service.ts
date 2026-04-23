import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UserService {
  constructor(private sb: SupabaseService) {}

  async create(username: string, password: string) {
    const hashed = await bcrypt.hash(password, 10);
    const { data, error } = await this.sb.client
      .from('users')
      .insert({ username, password: hashed })
      .select('id, username, password, avatar_url, theme')
      .single();
    if (error) throw error;
    return data;
  }

  async findByUsername(username: string) {
    const { data } = await this.sb.client
      .from('users')
      .select('id, username, password, avatar_url, theme')
      .eq('username', username)
      .single();
    return data;
  }

  async findById(id: string) {
    const { data } = await this.sb.client
      .from('users')
      .select('id, username, password, avatar_url, theme')
      .eq('id', id)
      .single();
    return data;
  }

  async getAll() {
    const { data } = await this.sb.client
      .from('users')
      .select('id, username, avatar_url');
    return data || [];
  }

  async validatePassword(plain: string, hashed: string) {
    return bcrypt.compare(plain, hashed);
  }

  async updateAvatar(userId: string, avatarUrl: string) {
    const { data } = await this.sb.client
      .from('users')
      .update({ avatar_url: avatarUrl })
      .eq('id', userId)
      .select('id, username, avatar_url')
      .single();
    return data;
  }

  async resetPassword(userId: string, oldPassword: string, newPassword: string): Promise<boolean> {
    const user = await this.findById(userId);
    if (!user) return false;
    const valid = await bcrypt.compare(oldPassword, user.password);
    if (!valid) return false;
    const hashed = await bcrypt.hash(newPassword, 10);
    await this.sb.client.from('users').update({ password: hashed }).eq('id', userId);
    return true;
  }

  async updateTheme(userId: string, theme: string) {
    await this.sb.client.from('users').update({ theme }).eq('id', userId);
    return { theme };
  }

  async uploadAvatar(fileBuffer: Buffer, fileName: string, mimeType: string, userId: string): Promise<string> {
    const path = `avatars/${userId}_${Date.now()}_${fileName}`;
    const { error } = await this.sb.client.storage
      .from('KartheBucket')
      .upload(path, fileBuffer, { contentType: mimeType, upsert: true });
    if (error) throw error;
    const { data } = this.sb.client.storage.from('KartheBucket').getPublicUrl(path);
    return data.publicUrl;
  }
}
