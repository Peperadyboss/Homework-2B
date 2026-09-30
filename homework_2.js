const mongoose = require('mongoose');
const { Schema } = mongoose;

const studentSchema = new Schema({
  name: { type: String, required: true },
  courses: [{ type: Schema.Types.ObjectId, ref: 'Course' }],
});

const courseSchema = new Schema({
  title: { type: String, required: true },
  students: [{ type: Schema.Types.ObjectId, ref: 'Student' }],
  maxStudents: { type: Number, required: true },
  availableSlots: { type: Number, required: true },
});

const Student = mongoose.model('Student', studentSchema);
const Course = mongoose.model('Course', courseSchema);

async function enrollCourse(studentId, courseId) {
  const student = await Student.findById(studentId);
  if (!student) throw new Error('Student not found');

  const course = await Course.findById(courseId);
  if (!course) throw new Error('Course not found');

  if (student.courses.some((c) => c.equals(courseId))) {
    throw new Error('Student is already enrolled in this course');
  }

  if (course.availableSlots <= 0) {
    throw new Error('Course is full');
  }

  const updatedCourse = await Course.findOneAndUpdate(
    { _id: courseId, availableSlots: { $gt: 0 }, students: { $ne: studentId } },
    { $addToSet: { students: studentId }, $inc: { availableSlots: -1 } },
    { new: true }
  );
  if (!updatedCourse) throw new Error('Enrollment failed: course full or already enrolled');

  try {
    await Student.updateOne({ _id: studentId }, { $addToSet: { courses: courseId } });
  } catch (err) {

    await Course.updateOne(
      { _id: courseId },
      { $pull: { students: studentId }, $inc: { availableSlots: 1 } }
    );
    throw err;
  }

  return updatedCourse;
}


async function dropCourse(studentId, courseId) {

  const updatedCourse = await Course.findOneAndUpdate(
    { _id: courseId, students: studentId },
    { $pull: { students: studentId }, $inc: { availableSlots: 1 } },
    { new: true }
  );
  if (!updatedCourse) throw new Error('Student is not enrolled in this course');

  await Student.updateOne({ _id: studentId }, { $pull: { courses: courseId } });
  return updatedCourse;
}

(async () => {
  await mongoose.connect('mongodb+srv://baokhangryan_db_user:(password)@cluster0.7xo86oo.mongodb.net/?appName=Cluster0');
  await Student.deleteMany({});
  await Course.deleteMany({});

  const s1 = await Student.create({ name: 'An' });
  const s2 = await Student.create({ name: 'Binh' });
  const c1 = await Course.create({
    title: 'Databases',
    maxStudents: 1,
    availableSlots: 1,
  });

  console.log('Enroll An:', (await enrollCourse(s1._id, c1._id)).availableSlots); // 0
  try { await enrollCourse(s1._id, c1._id); } catch (e) { console.log('Duplicate:', e.message); }
  try { await enrollCourse(s2._id, c1._id); } catch (e) { console.log('Full:', e.message); }
  console.log('Drop An:', (await dropCourse(s1._id, c1._id)).availableSlots); // 1

  await mongoose.disconnect();
})();

module.exports = { Student, Course, enrollCourse, dropCourse };