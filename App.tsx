import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from './firebaseConfig';

type Note = {
  id: string;
  title: string;
  content: string;
  favorite: boolean;
  createdAt?: { toDate: () => Date };
  updatedAt?: { toDate: () => Date };
  userId: string;
};

const colors = {
  ink: '#183B46',
  muted: '#66838A',
  primary: '#D94F83',
  primaryLight: '#FCEBF2',
  secondary: '#159A9C',
  secondaryLight: '#E6F6F5',
  background: '#FFF8FA',
  card: '#FFFFFF',
  border: '#DCEBEB',
  danger: '#C94B68',
  gold: '#E5A93D',
};

function friendlyAuthError(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : '';
  if (code === 'auth/invalid-credential') return 'The email or password is incorrect.';
  if (code === 'auth/email-already-in-use') return 'An account already exists for this email.';
  if (code === 'auth/weak-password') return 'Use a password with at least 6 characters.';
  if (code === 'auth/invalid-email') return 'Enter a valid email address.';
  return 'Something went wrong. Please try again.';
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => onAuthStateChanged(auth, (nextUser) => {
    setUser(nextUser);
    setAuthLoading(false);
  }), []);

  if (authLoading) {
    return <LoadingScreen />;
  }

  return user ? <NotesScreen user={user} /> : <AuthScreen />;
}

function LoadingScreen() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.primary} style={{ marginTop: 18 }} />
    </View>
  );
}

function AuthScreen() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing details', 'Enter your email and password to continue.');
      return;
    }
    setLoading(true);
    try {
      if (isSignUp) await createUserWithEmailAndPassword(auth, email.trim(), password);
      else await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      Alert.alert(isSignUp ? 'Could not create account' : 'Could not sign in', friendlyAuthError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.authSafe}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.authContainer} keyboardShouldPersistTaps="handled">
        <Text style={styles.authEyebrow}>PERSONAL NOTES</Text>
        <Text style={styles.authTitle}>{isSignUp ? 'Create Account' : 'Sign In'}</Text>
      
        <View style={styles.form}>
          <Text style={styles.label}>EMAIL ADDRESS</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor="#A7B1C2"
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
          />
          <Text style={styles.label}>PASSWORD</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="At least 6 characters"
            placeholderTextColor="#A7B1C2"
            secureTextEntry
            style={styles.input}
          />
          <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} onPress={submit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{isSignUp ? 'Create account' : 'Sign in'}</Text>}
          </Pressable>
        </View>
        <Pressable onPress={() => setIsSignUp(!isSignUp)} style={styles.switchAuth}>
          <Text style={styles.switchLink}>{isSignUp ? 'Sign in' : 'Create an account'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function NotesScreen({ user }: { user: User }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [showFavorites, setShowFavorites] = useState(false);
  const [editorVisible, setEditorVisible] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [notesLoading, setNotesLoading] = useState(true);

  useEffect(() => {
    const notesQuery = query(
      collection(db, 'notes'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
    );
    return onSnapshot(notesQuery, (snapshot) => {
      setNotes(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as Note)));
      setNotesLoading(false);
    }, () => {
      setNotesLoading(false);
      Alert.alert('Could not load notes', 'Check your connection and try again.');
    });
  }, [user.uid]);

  const visibleNotes = useMemo(
    () => showFavorites ? notes.filter((note) => note.favorite) : notes,
    [notes, showFavorites],
  );

  const saveNote = async (title: string, content: string, favorite: boolean) => {
    if (!title.trim() && !content.trim()) {
      Alert.alert('Empty note', 'Add a title or some content before saving.');
      return;
    }
    try {
      if (editing) {
        await updateDoc(doc(db, 'notes', editing.id), {
          title: title.trim() || 'Untitled note',
          content: content.trim(),
          favorite,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'notes'), {
          title: title.trim() || 'Untitled note',
          content: content.trim(),
          favorite,
          userId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      setEditorVisible(false);
      setEditing(null);
    } catch {
      Alert.alert('Could not save note', 'Please check your connection and try again.');
    }
  };

  const removeNote = (note: Note) => {
    Alert.alert('Delete note?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteDoc(doc(db, 'notes', note.id)); }
        catch { Alert.alert('Could not delete note', 'Please try again.'); }
      } },
    ]);
  };

  const toggleFavorite = async (note: Note) => {
    try { await updateDoc(doc(db, 'notes', note.id), { favorite: !note.favorite, updatedAt: serverTimestamp() }); }
    catch { Alert.alert('Could not update favorite', 'Please try again.'); }
  };

  return (
    <SafeAreaView style={styles.appSafe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View>
          <Text style={styles.headerGreeting}>YOUR NOTEBOOK</Text>
          <Text style={styles.headerTitle}>All your thoughts, <Text style={styles.headerAccent}>in one place.</Text></Text>
        </View>
        <Pressable onPress={() => signOut(auth)} style={styles.logout}><Text style={styles.logoutText}>↗</Text></Pressable>
      </View>
      <View style={styles.statsRow}>
        <View><Text style={styles.statNumber}>{notes.length}</Text><Text style={styles.statLabel}>TOTAL NOTES</Text></View>
        <View style={styles.filter}>
          <Pressable onPress={() => setShowFavorites(false)} style={[styles.filterButton, !showFavorites && styles.filterActive]}>
            <Text style={[styles.filterText, !showFavorites && styles.filterTextActive]}>All notes</Text>
          </Pressable>
          <Pressable onPress={() => setShowFavorites(true)} style={[styles.filterButton, showFavorites && styles.filterActive]}>
            <Text style={[styles.filterText, showFavorites && styles.filterTextActive]}>★ Favorites</Text>
          </Pressable>
        </View>
      </View>
      {notesLoading ? <ActivityIndicator color={colors.primary} style={styles.listLoading} /> : (
        <FlatList
          data={visibleNotes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<EmptyState favorites={showFavorites} />}
          renderItem={({ item }) => (
            <NoteCard note={item} onEdit={() => { setEditing(item); setEditorVisible(true); }} onDelete={() => removeNote(item)} onFavorite={() => toggleFavorite(item)} />
          )}
        />
      )}
      <Pressable style={({ pressed }) => [styles.addButton, pressed && styles.pressed]} onPress={() => { setEditing(null); setEditorVisible(true); }}>
        <Text style={styles.addButtonText}>＋</Text><Text style={styles.addButtonLabel}>New note</Text>
      </Pressable>
      <NoteEditor visible={editorVisible} note={editing} onClose={() => { setEditorVisible(false); setEditing(null); }} onSave={saveNote} />
    </SafeAreaView>
  );
}

function NoteCard({ note, onEdit, onDelete, onFavorite }: { note: Note; onEdit: () => void; onDelete: () => void; onFavorite: () => void }) {
  const date = note.createdAt?.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) ?? 'Just now';
  return (
    <View style={styles.noteCard}>
      <View style={styles.noteCardTop}>
        <Text style={styles.noteDate}>{date.toUpperCase()}</Text>
        <Pressable onPress={onFavorite} hitSlop={10}><Text style={[styles.star, note.favorite && styles.starActive]}>★</Text></Pressable>
      </View>
      <Text style={styles.noteTitle} numberOfLines={1}>{note.title}</Text>
      <Text style={styles.notePreview} numberOfLines={2}>{note.content || 'No content'}</Text>
      <View style={styles.noteActions}>
        <Pressable onPress={onEdit} style={styles.action}><Text style={styles.actionIcon}>✎</Text><Text style={styles.actionText}>Edit</Text></Pressable>
        <Pressable onPress={onDelete} style={styles.action}><Text style={[styles.actionIcon, { color: colors.danger }]}>⌫</Text><Text style={[styles.actionText, { color: colors.danger }]}>Delete</Text></Pressable>
      </View>
    </View>
  );
}

function EmptyState({ favorites }: { favorites: boolean }) {
  return <View style={styles.empty}><Text style={styles.emptyIcon}>{favorites ? '★' : '✦'}</Text><Text style={styles.emptyTitle}>{favorites ? 'No favorites yet' : 'Your notebook is empty'}</Text><Text style={styles.emptyText}>{favorites ? 'Tap the star on a note to find it here.' : 'Capture an idea, a reminder, or anything on your mind.'}</Text></View>;
}

function NoteEditor({ visible, note, onClose, onSave }: { visible: boolean; note: Note | null; onClose: () => void; onSave: (title: string, content: string, favorite: boolean) => void }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [favorite, setFavorite] = useState(false);
  useEffect(() => { if (visible) { setTitle(note?.title ?? ''); setContent(note?.content ?? ''); setFavorite(note?.favorite ?? false); } }, [visible, note]);
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.editor}>
          <View style={styles.editorHeader}><Text style={styles.editorTitle}>{note ? 'Edit note' : 'New note'}</Text><Pressable onPress={onClose}><Text style={styles.close}>×</Text></Pressable></View>
          <TextInput value={title} onChangeText={setTitle} placeholder="Note title" placeholderTextColor="#A7B1C2" style={styles.titleInput} autoFocus={!note} />
          <TextInput value={content} onChangeText={setContent} placeholder="Start writing..." placeholderTextColor="#A7B1C2" style={styles.contentInput} multiline textAlignVertical="top" />
          <View style={styles.editorBottom}><Pressable onPress={() => setFavorite(!favorite)} style={styles.favoriteToggle}><Text style={[styles.star, favorite && styles.starActive]}>★</Text><Text style={styles.favoriteText}>Favorite</Text></Pressable><Pressable onPress={() => onSave(title, content, favorite)} style={styles.saveButton}><Text style={styles.saveText}>Save note</Text></Pressable></View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({

  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },

 
  
  authSafe: { flex: 1, backgroundColor: colors.background },
  authContainer: { flexGrow: 1, padding: 28, paddingTop: 55 },
  authEyebrow: { color: colors.primary, fontSize: 12, fontWeight: '800', letterSpacing: 1.8, marginTop: 44 },
  authTitle: { color: colors.ink, fontSize: 36, lineHeight: 42, fontWeight: '800', marginTop: 12 },
  authSubtitle: { color: colors.muted, fontSize: 16, lineHeight: 24, marginTop: 14, maxWidth: 310 },
  form: { marginTop: 40 },
  label: { color: colors.muted, fontSize: 11, letterSpacing: 1.2, fontWeight: '800', marginBottom: 9, marginTop: 18 },
  input: { height: 54, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.card, paddingHorizontal: 16, color: colors.ink, fontSize: 16 },
  primaryButton: { height: 56, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 30, shadowColor: colors.primary, shadowOpacity: 0.25, shadowRadius: 10, elevation: 3 },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  switchAuth: { alignItems: 'center', marginTop: 28 }, switchText: { color: colors.muted, fontSize: 14 }, switchLink: { color: colors.primary, fontWeight: '700' },
  appSafe: { flex: 1, backgroundColor: colors.background }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 22, paddingTop: 24 },
  headerGreeting: { color: colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 }, headerTitle: { color: colors.ink, fontSize: 25, fontWeight: '800', marginTop: 8 }, headerAccent: { color: colors.primary },
  logout: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border }, logoutText: { color: colors.muted, fontSize: 23, transform: [{ rotate: '90deg' }] },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 22, marginTop: 30 }, statNumber: { color: colors.ink, fontSize: 30, fontWeight: '800' }, statLabel: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.1, marginTop: 2 },
  filter: { flexDirection: 'row', backgroundColor: colors.secondaryLight, padding: 4, borderRadius: 10 }, filterButton: { paddingVertical: 9, paddingHorizontal: 11, borderRadius: 8 }, filterActive: { backgroundColor: colors.card, shadowColor: colors.secondary, shadowOpacity: 0.12, shadowRadius: 4, elevation: 1 }, filterText: { color: colors.muted, fontSize: 12, fontWeight: '700' }, filterTextActive: { color: colors.secondary },
  listContent: { padding: 22, paddingBottom: 110, flexGrow: 1 }, listLoading: { marginTop: 70 }, noteCard: { backgroundColor: colors.card, borderRadius: 16, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: colors.border }, noteCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, noteDate: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1 }, star: { color: '#C9D0DD', fontSize: 21 }, starActive: { color: colors.gold }, noteTitle: { color: colors.ink, fontSize: 19, fontWeight: '800', marginTop: 12 }, notePreview: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 7 }, noteActions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border, marginTop: 17, paddingTop: 12, gap: 20 }, action: { flexDirection: 'row', alignItems: 'center', gap: 6 }, actionIcon: { color: colors.primary, fontSize: 17 }, actionText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  empty: { alignItems: 'center', justifyContent: 'center', flex: 1, paddingHorizontal: 30, paddingTop: 80 }, emptyIcon: { color: colors.primary, fontSize: 35 }, emptyTitle: { color: colors.ink, fontSize: 20, fontWeight: '800', marginTop: 14 }, emptyText: { color: colors.muted, textAlign: 'center', lineHeight: 21, marginTop: 8 },
  addButton: { position: 'absolute', bottom: 24, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, borderRadius: 28, paddingVertical: 14, paddingHorizontal: 22, shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 }, addButtonText: { color: '#fff', fontSize: 25, lineHeight: 25, marginRight: 7 }, addButtonLabel: { color: '#fff', fontWeight: '800', fontSize: 15 },
  pressed: { opacity: 0.8 }, modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(21,154,156,0.28)' }, editor: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, minHeight: '60%' }, editorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, editorTitle: { color: colors.ink, fontSize: 22, fontWeight: '800' }, close: { color: colors.muted, fontSize: 30, fontWeight: '300' }, titleInput: { color: colors.ink, fontSize: 24, fontWeight: '800', marginTop: 28, paddingVertical: 8 }, contentInput: { color: colors.ink, fontSize: 16, lineHeight: 25, flex: 1, marginTop: 14, minHeight: 130 }, editorBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 15 }, favoriteToggle: { flexDirection: 'row', alignItems: 'center', gap: 7 }, favoriteText: { color: colors.muted, fontWeight: '700' }, saveButton: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 13 }, saveText: { color: '#fff', fontWeight: '800' },
});
