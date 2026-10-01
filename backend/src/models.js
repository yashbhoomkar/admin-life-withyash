import mongoose from 'mongoose';

const playlistSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  embedUrl: { type: String, required: true },
  order: { type: Number, default: 0 },
}, { timestamps: true });

const dialogueSchema = new mongoose.Schema({
  text: { type: String, required: true },
  order: { type: Number, default: 0 },
}, { timestamps: true });

const messageSchema = new mongoose.Schema({
  name: { type: String, trim: true, maxlength: 100 },
  message: { type: String, required: true, trim: true, maxlength: 5000 },
}, { timestamps: true });

const imageSchema = new mongoose.Schema({
  data: { type: Buffer, required: true },
  contentType: { type: String, required: true },
  width: { type: Number, required: true },
  height: { type: Number, required: true },
}, { _id: false });

const carPhotoSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  thumbnail: { type: imageSchema, required: true },
  full: { type: imageSchema, required: true },
  order: { type: Number, default: 0 },
}, { timestamps: true });

const sectionSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  title: { type: String, required: true, trim: true, maxlength: 60 },
  order: { type: Number, required: true },
});

const visitCounterSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  count: { type: Number, required: true, default: 0 },
}, { timestamps: true });

export const Playlist = mongoose.model('Playlist', playlistSchema);
export const Dialogue = mongoose.model('Dialogue', dialogueSchema);
export const VisitorMessage = mongoose.model('VisitorMessage', messageSchema);
export const CarPhoto = mongoose.model('CarPhoto', carPhotoSchema);
export const Section = mongoose.model('Section', sectionSchema);
export const VisitCounter = mongoose.model('VisitCounter', visitCounterSchema);
