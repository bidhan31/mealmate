import { useCallback, useEffect, useState } from 'react';
import { Phone } from 'lucide-react';
import { membershipApi, roomApi } from '@/api/homeApi';
import { useAppSelector } from '@/app/hooks';
import type { MemberDto, RoomDto } from '@/types/home';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { UserAvatar } from '@/components/ui/UserAvatar';

export default function MembersPage() {
  const membership = useAppSelector((s) => s.home.membership);
  const home = useAppSelector((s) => s.home.home);
  const isAdmin = membership?.role === 'admin';

  const [members, setMembers] = useState<MemberDto[]>([]);
  const [rooms, setRooms] = useState<RoomDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [roomName, setRoomName] = useState('');
  const [roomRent, setRoomRent] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');

  // Edit room state
  const [editingRoom, setEditingRoom] = useState<{ id: string; name: string; totalRent: string } | null>(null);

  // Edit member state
  const [editingMember, setEditingMember] = useState<{ id: string; role: string; roomId: string | null } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [m, r] = await Promise.all([membershipApi.list(), roomApi.list()]);
      setMembers(m.data.data.members);
      setRooms(r.data.data.rooms);
    } catch (e) {
      const x = e as { response?: { data?: { message?: string } } };
      setError(x.response?.data?.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pending = members.filter((m) => m.status === 'pending');
  const active = members.filter((m) => m.status === 'active');
  const invited = members.filter((m) => m.status === 'invited');

  const act = async (fn: () => Promise<unknown>) => {
    try {
      setError(null);
      await fn();
    } catch (e) {
      const x = e as { response?: { data?: { message?: string } } };
      setError(x.response?.data?.message ?? 'Action failed');
    } finally {
      await load();
    }
  };

  const createRoom = async () => {
    const rent = Number(roomRent) || 0;
    if (roomName.trim().length < 1) return;
    await act(() => roomApi.create(roomName.trim(), rent));
    setRoomName('');
    setRoomRent('');
  };

  const saveRoomEdit = async () => {
    if (!editingRoom) return;
    const rent = Number(editingRoom.totalRent) || 0;
    if (editingRoom.name.trim().length < 1) return;
    await act(() => roomApi.update(editingRoom.id, { name: editingRoom.name.trim(), totalRent: rent }));
    setEditingRoom(null);
  };

  const saveMemberEdit = async () => {
    if (!editingMember) return;
    
    // Find original member to see what changed
    const original = active.find((m) => m.id === editingMember.id);
    if (!original) return;

    try {
      setError(null);
      
      // Update role if changed
      if (original.role !== editingMember.role) {
        await membershipApi.updateRole(editingMember.id, editingMember.role);
      }
      
      // Update room if changed
      if (original.roomId !== editingMember.roomId) {
        await roomApi.assign(editingMember.id, editingMember.roomId);
      }
      
      setEditingMember(null);
    } catch (e) {
      const x = e as { response?: { data?: { message?: string } } };
      setError(x.response?.data?.message ?? 'Failed to update member');
    } finally {
      await load();
    }
  };

  const sendInvite = async () => {
    if (!inviteEmail.includes('@')) return;
    await act(() => membershipApi.invite(inviteEmail.trim()));
    setInviteEmail('');
  };

  if (loading) return <div className="text-muted-foreground animate-pulse">Loading…</div>;

  return (
    <div className="space-y-6">
      {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive">{error}</p>}

      {home && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Invite code</p>
              <p className="text-xl font-bold tracking-widest text-primary mt-1">{home.inviteCode}</p>
            </div>
            <p className="text-sm text-muted-foreground hidden sm:block">Share this code so others can request to join.</p>
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Invite New Member</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <Input
                  id="invite-email"
                  label="Email address"
                  placeholder="user@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <Button onClick={sendInvite} disabled={!inviteEmail.includes('@')} className="mb-0.5">
                Send Invitation
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isAdmin && pending.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending join requests</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border/50">
              {pending.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <UserAvatar name={m.user?.name} avatar={m.user?.avatar} size="md" />
                    <div>
                      <p className="text-sm font-medium">{m.user?.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{m.user?.email}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => act(() => membershipApi.approve(m.id))}>
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => act(() => membershipApi.reject(m.id))}
                    >
                      Reject
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {isAdmin && invited.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sent Invitations</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border/50">
              {invited.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <UserAvatar name={m.user?.name} avatar={m.user?.avatar} size="md" />
                    <div>
                      <p className="text-sm font-medium">{m.user?.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{m.user?.email}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => act(() => membershipApi.remove(m.id))}
                    >
                      Cancel Invite
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Room</TableHead>
                {isAdmin && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {active.map((m) => {
                const isEditing = editingMember?.id === m.id;
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <UserAvatar name={m.user?.name} avatar={m.user?.avatar} size="md" />
                        <div>
                          <p className="font-medium">{m.user?.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{m.user?.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {m.user?.phone ? (
                        <a
                          href={`tel:${m.user.phone}`}
                          className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-primary hover:underline bg-primary/5 px-2 py-1 rounded-md border border-primary/10"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          {m.user.phone}
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="capitalize text-muted-foreground">
                      {isEditing ? (
                        <select
                          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring capitalize"
                          value={editingMember.role}
                          onChange={(e) => setEditingMember({ ...editingMember, role: e.target.value })}
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                        </select>
                      ) : (
                        <p className={`text-xs font-semibold tracking-wider uppercase inline px-1 rounded-[24px] ${m.role === "admin" ? "text-primary border border-primary bg-primary/10 tracking-[2.5px]" : "text-[yellow]/70 bg-[yellow]/10 border border-[yellow]/80 "}`}>{m.role}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <select
                          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          value={editingMember.roomId ?? ''}
                          onChange={(e) => setEditingMember({ ...editingMember, roomId: e.target.value || null })}
                        >
                          <option value="">— none —</option>
                          {rooms.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-muted-foreground">{rooms.find((r) => r.id === m.roomId)?.name ?? '—'}</span>
                      )}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {isEditing ? (
                            <>
                              <Button variant="outline" size="sm" onClick={() => setEditingMember(null)}>
                                Cancel
                              </Button>
                              <Button size="sm" onClick={saveMemberEdit}>
                                Save
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingMember({ id: m.id, role: m.role, roomId: m.roomId })}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => act(() => membershipApi.remove(m.id))}
                              >
                                Remove
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rooms &amp; Rent</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border/50 mb-6">
            {rooms.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-4">
                {editingRoom?.id === r.id ? (
                  <div className="flex-1 flex flex-wrap items-end gap-3 mr-4">
                    <div className="flex-1 min-w-[120px]">
                      <Input
                        id={`edit-name-${r.id}`}
                        label="Room name"
                        value={editingRoom.name}
                        onChange={(e) => setEditingRoom({ ...editingRoom, name: e.target.value })}
                      />
                    </div>
                    <div className="w-24">
                      <Input
                        id={`edit-rent-${r.id}`}
                        label="Rent"
                        type="number"
                        value={editingRoom.totalRent}
                        onChange={(e) => setEditingRoom({ ...editingRoom, totalRent: e.target.value })}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex-1">
                    <p className="text-sm font-medium">{r.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      ৳{r.totalRent} total &middot; {r.memberCount} member(s) &middot; ৳{r.rentPerMember} each
                    </p>
                  </div>
                )}
                {isAdmin && (
                  <div className="flex gap-2 shrink-0">
                    {editingRoom?.id === r.id ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingRoom(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={saveRoomEdit}
                          disabled={editingRoom.name.trim().length < 1}
                        >
                          Save
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingRoom({ id: r.id, name: r.name, totalRent: String(r.totalRent) })}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => act(() => roomApi.remove(r.id))}
                        >
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </li>
            ))}
            {rooms.length === 0 && <li className="py-4 text-sm text-muted-foreground">No rooms yet.</li>}
          </ul>

          {isAdmin && (
            <div className="flex flex-wrap items-end gap-3 bg-muted/30 p-4 rounded-xl border border-border/50">
              <div className="flex-1 min-w-[140px]">
                <Input
                  id="room-name"
                  label="Room name"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                />
              </div>
              <div className="w-32">
                <Input
                  id="room-rent"
                  label="Total rent"
                  type="number"
                  value={roomRent}
                  onChange={(e) => setRoomRent(e.target.value)}
                />
              </div>
              <Button onClick={createRoom} disabled={roomName.trim().length < 1} className="mb-0.5">
                Add room
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
