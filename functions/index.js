const { onDocumentDeleted } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

initializeApp();

/** The client app can only delete its own signed-in Auth account, never someone
 * else's — that boundary is enforced by Firebase itself. Removing a teammate
 * (`removeTeammate` in profiles.service.ts) deletes their `sotw_profiles` doc;
 * this function reacts to that deletion and cleans up the matching Auth account
 * so a removed member's login doesn't linger forever. */
exports.deleteAuthOnProfileRemoved = onDocumentDeleted('sotw_profiles/{uid}', async (event) => {
  const uid = event.params.uid;
  await getAuth()
    .deleteUser(uid)
    .catch((err) => {
      if (err.code !== 'auth/user-not-found') throw err;
    });
});
