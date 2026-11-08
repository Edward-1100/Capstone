import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createInviteLinkRequest, inviteMemberRequest, listInviteLinksRequest, listMembersRequest, removeMemberRequest, revokeInviteLinkRequest, setMemberRoleRequest } from '../../api/members';
import { getWorldRequest } from '../../api/worlds';
import Page from '../../components/Page';

export default function CollaborationPage() {
  const {id} = useParams();
  const navigate = useNavigate();

  const [world, setWorld] = useState(null);
  const [members, setMembers] = useState([]);
  const [links, setLinks] = useState([]);
  const [username, setUsername] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [linkRole, setLinkRole] = useState('viewer');
  const [removingId, setRemovingId] = useState(null);
  const [revokingId, setRevokingId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [inviteError, setInviteError] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getWorldRequest(id), listMembersRequest(id), listInviteLinksRequest(id)])
      .then(([worldData, memberData, linkData]) => {
        if (worldData.role !== 'owner') {
          navigate(`/worlds/${id}`, {replace: true});

          return;
        }

        setWorld(worldData);
        setMembers(memberData);
        setLinks(linkData);
      })
      .catch(() => navigate('/', {replace: true}));
  }, [id, navigate]);

  async function reloadMembers() {
    setMembers(await listMembersRequest(id));
  }

  async function reloadLinks() {
    setLinks(await listInviteLinksRequest(id));
  }

  async function handleInvite(event) {
    event.preventDefault();
    setInviteError('');

    try {
      await inviteMemberRequest(id, username, inviteRole);
      setUsername('');
      await reloadMembers();
    } catch (err) {
      setInviteError(err.message);
    }
  }

  async function handleRoleChange(userId, role) {
    setError('');

    try {
      await setMemberRoleRequest(id, userId, role);
      await reloadMembers();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRemove(userId) {
    setError('');

    try {
      await removeMemberRequest(id, userId);
      setRemovingId(null);
      await reloadMembers();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCreateLink(event) {
    event.preventDefault();
    setError('');

    try {
      await createInviteLinkRequest(id, linkRole);
      await reloadLinks();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRevoke(linkId) {
    setError('');

    try {
      await revokeInviteLinkRequest(id, linkId);
      setRevokingId(null);
      await reloadLinks();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCopy(link) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/join/${link.token}`);
      setCopiedId(link.id);
    } catch {
      setCopiedId(null);
    }
  }

  if (!world) {
    return <Page><p>Loading</p></Page>;
  }

  return (
    <Page size="medium" crumbs={[{to: '/', label: 'Your worlds'}, {to: `/worlds/${id}`, label: world.name}, {label: 'Collaboration'}]}>
      <div className="panel">
        <h1 className="title">Collaboration</h1>

        {error && <p role="alert">{error}</p>}

        <div>
          <h2>Members</h2>

          <ul className="member-list">
            {members.map((member) => (
              <li key={member.userId}>
                <span>{member.username}</span>

                {member.role === 'owner' && <span className="muted">owner</span>}

                {member.role !== 'owner' && (
                  <select aria-label={`Role of ${member.username}`} value={member.role} onChange={(e) => handleRoleChange(member.userId, e.target.value)}>
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                  </select>
                )}

                {member.pendingRole && <span className="muted">invited as {member.pendingRole}, not accepted yet</span>}

                {member.role !== 'owner' && removingId !== member.userId && (
                  <button type="button" onClick={() => setRemovingId(member.userId)}>{member.pendingRole ? 'Cancel invite' : 'Remove'}</button>
                )}

                {removingId === member.userId && (
                  <>
                    <span>{member.pendingRole ? 'Cancel this invite?' : `Remove ${member.username}?`}</span>
                    <button type="button" className="danger" onClick={() => handleRemove(member.userId)}>{member.pendingRole ? 'Yes, cancel' : 'Yes, remove'}</button>
                    <button type="button" onClick={() => setRemovingId(null)}>Keep</button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2>Invite by username</h2>

          <form className="inline-form" onSubmit={handleInvite}>
            <input type="text" aria-label="Username" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={45}/>

            <select aria-label="Invite as" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
            </select>

            <button type="submit" disabled={username.trim() === ''}>Invite</button>

            {inviteError && <p role="alert">{inviteError}</p>}
          </form>
        </div>

        <div>
          <h2>Invite links</h2>

          {links.length === 0 && <p className="muted">No invite links</p>}

          <ul className="member-list">
            {links.map((link) => (
              <li key={link.id}>
                <span>{link.role === 'editor' ? 'Editor' : 'Viewer'}</span>

                <span className="link-url">{`${window.location.origin}/join/${link.token}`}</span>

                <button type="button" onClick={() => handleCopy(link)}>{copiedId === link.id ? 'Copied' : 'Copy'}</button>

                {revokingId !== link.id && <button type="button" onClick={() => setRevokingId(link.id)}>Revoke</button>}

                {revokingId === link.id && (
                  <>
                    <span>Revoke this link?</span>
                    <button type="button" className="danger" onClick={() => handleRevoke(link.id)}>Yes, revoke</button>
                    <button type="button" onClick={() => setRevokingId(null)}>Keep</button>
                  </>
                )}
              </li>
            ))}
          </ul>

          <form className="inline-form" onSubmit={handleCreateLink}>
            <select aria-label="Link gives" value={linkRole} onChange={(e) => setLinkRole(e.target.value)}>
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
            </select>

            <button type="submit">Create link</button>
          </form>
        </div>
      </div>
    </Page>
  );
}
