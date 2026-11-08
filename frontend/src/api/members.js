import { apiFetch } from './client';

export function listMembersRequest(worldId) {
  return apiFetch(`/worlds/${worldId}/members`);
}

export function inviteMemberRequest(worldId, username, role) {
  return apiFetch(`/worlds/${worldId}/members`, {method: 'POST', body: JSON.stringify({username, role})});
}

export function setMemberRoleRequest(worldId, userId, role) {
  return apiFetch(`/worlds/${worldId}/members/${userId}`, {method: 'PATCH', body: JSON.stringify({role})});
}

export function removeMemberRequest(worldId, userId) {
  return apiFetch(`/worlds/${worldId}/members/${userId}`, {method: 'DELETE'});
}

export function leaveWorldRequest(worldId) {
  return apiFetch(`/worlds/${worldId}/membership`, {method: 'DELETE'});
}

export function acceptInviteRequest(worldId) {
  return apiFetch(`/worlds/${worldId}/membership/accept`, {method: 'POST'});
}

export function denyInviteRequest(worldId) {
  return apiFetch(`/worlds/${worldId}/membership/deny`, {method: 'POST'});
}

export function listInviteLinksRequest(worldId) {
  return apiFetch(`/worlds/${worldId}/invite-links`);
}

export function createInviteLinkRequest(worldId, role) {
  return apiFetch(`/worlds/${worldId}/invite-links`, {method: 'POST', body: JSON.stringify({role})});
}

export function revokeInviteLinkRequest(worldId, linkId) {
  return apiFetch(`/worlds/${worldId}/invite-links/${linkId}`, {method: 'DELETE'});
}

export function joinByLinkRequest(token) {
  return apiFetch(`/invites/${token}/join`, {method: 'POST'});
}

export function listBlocksRequest() {
  return apiFetch('/blocks');
}

export function addBlockRequest(username) {
  return apiFetch('/blocks', {method: 'POST', body: JSON.stringify({username})});
}

export function removeBlockRequest(userId) {
  return apiFetch(`/blocks/${userId}`, {method: 'DELETE'});
}
