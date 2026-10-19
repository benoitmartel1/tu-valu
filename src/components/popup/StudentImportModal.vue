<script setup>
import { computed, ref, watch, onUnmounted } from "vue";
import {
  ArrowLeft,
  Upload,
  X,
  Image as ImageIcon,
  FileText,
} from "@lucide/vue";
import { preferences } from "../../stores/preferences";
import { photoCandidates, parseDelimited } from "../../lib/domain";
import { allRows } from "../../lib/data";
import { supabase } from "../../supabase";
import { userId } from "../../stores/auth";
import Popup from "./Popup.vue";

// Levenshtein distance function for fuzzy string matching
function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;
  const dp = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function longestCommonSubstringLength(first, second) {
  let longest = 0;
  const lengths = Array(second.length + 1).fill(0);

  for (let firstIndex = 1; firstIndex <= first.length; firstIndex++) {
    for (let secondIndex = second.length; secondIndex > 0; secondIndex--) {
      if (first[firstIndex - 1] === second[secondIndex - 1]) {
        lengths[secondIndex] = lengths[secondIndex - 1] + 1;
        longest = Math.max(longest, lengths[secondIndex]);
      } else {
        lengths[secondIndex] = 0;
      }
    }
  }

  return longest;
}

function findStudentByFilename(filename, students) {
  const candidates = photoCandidates(filename, students);
  return candidates[0]?.score >= 80 &&
    candidates[0].score > (candidates[1]?.score || 0)
    ? candidates[0].student
    : null;
}

const emit = defineEmits(["close", "imported", "photos-imported"]);

// Import type selection
const importType = ref(null); // 'students' or 'pictures'

// Students import state (existing)
const rawText = ref("");
const pasteArea = ref(null);
let resizeObserver;
const filePreviews = new Map();
watch(pasteArea, (element) => {
  resizeObserver?.disconnect();
  if (element) {
    resizeObserver = new ResizeObserver(() => {
      preferences.pasteHeight = Math.round(
        element.getBoundingClientRect().height,
      );
    });
    resizeObserver.observe(element);
  }
});
onUnmounted(() => {
  resizeObserver?.disconnect();
  for (const url of filePreviews.values()) URL.revokeObjectURL(url);
});
const loading = ref(false);
const errorMessage = ref("");
const step = ref("paste");
const columnMap = ref({
  group: 0,
  name: 1,
  gender: 2,
  birthDate: 3,
  studentNumber: -1,
  recordNumber: -1,
});

// Pictures import state (new)
const selectedFiles = ref([]);
const selectedClassId = ref(null);
const classes = ref([]);
const pictureStep = ref("select"); // 'select', 'class', 'match', 'upload', 'results'
const matchedStudents = ref([]);
const uploadResults = ref([]);
const studentSearchFilters = ref({}); // Track search text for each unmatched student index
const allStudentsForSearch = ref([]); // All students from DB for search

// Computed title for modal header
const modalTitle = computed(() => {
  if (!importType.value) return "Type d'import";

  if (importType.value === "students") {
    return step.value === "paste" ? "Coller les élèves" : "Vérifier l'import";
  }

  if (importType.value === "pictures") {
    switch (pictureStep.value) {
      case "select":
        return "Sélectionner les photos";
      case "class":
        return "Sélectionner la classe";
      case "match":
        return "Correspondance des élèves";
      case "upload":
        return "Import des photos";
      case "results":
        return "Résultats de l'import";
      default:
        return "Import de photos";
    }
  }

  return "Import";
});

const headers = computed(() => {
  const firstRow = rows.value[0] || [];
  return firstRow.map((value, index) => value || `Colonne ${index + 1}`);
});

const rows = computed(() => {
  try {
    return parseDelimited(rawText.value);
  } catch {
    return [];
  }
});

const dataRows = computed(() => {
  if (rows.value.length === 0) return [];
  const first = rows.value[0].map(normalizeHeader).join(" ");
  const hasHeader =
    first.includes("groupe") ||
    first.includes("nom") ||
    first.includes("prenom");
  return rows.value.slice(hasHeader ? 1 : 0);
});

// Get filtered students based on search text
function getFilteredStudents(searchText) {
  // Only show results if at least 2 characters
  if (!searchText || searchText.trim().length < 2) {
    return [];
  }

  const search = searchText.toLowerCase().trim();
  return allStudentsForSearch.value
    .filter(
      (s) =>
        s.firstname.toLowerCase().includes(search) ||
        s.lastname.toLowerCase().includes(search) ||
        `${s.firstname} ${s.lastname}`.toLowerCase().includes(search),
    )
    .map((s) => ({
      ...s,
      className: classes.value.find((c) => c.id === s.class_id)?.name || "",
    }));
}

const parsedStudents = computed(() =>
  dataRows.value
    .map((row) => {
      const fullName = row[columnMap.value.name] || "";
      const nameParts = fullName.split(",").map((part) => part.trim());
      const lastname = nameParts.length > 1 ? nameParts[0] : "";
      const firstname =
        nameParts.length > 1 ? nameParts.slice(1).join(", ") : fullName;

      // Parse student number if column is mapped
      let studentNumber = null;
      if (
        columnMap.value.studentNumber >= 0 &&
        row[columnMap.value.studentNumber]
      ) {
        studentNumber = String(row[columnMap.value.studentNumber]).trim();
      }

      return {
        recordNumber:
          columnMap.value.recordNumber >= 0
            ? String(row[columnMap.value.recordNumber] || "").trim()
            : null,
        group: (row[columnMap.value.group] || "").trim(),
        firstname: firstname.trim(),
        lastname: lastname.trim(),
        gender: normalizeGender(row[columnMap.value.gender]),
        birthDate: parseDate(row[columnMap.value.birthDate]),
        studentNumber: studentNumber,
      };
    })
    .filter(
      (student) => student.group && (student.firstname || student.lastname),
    ),
);

const previewRows = computed(() => parsedStudents.value.slice(0, 100));
const groupCount = computed(
  () => new Set(parsedStudents.value.map((student) => student.group)).size,
);

function detectDelimiter(line) {
  if (line.includes("\t")) return "\t";
  if (line.includes(";")) return ";";
  if (line.includes(",")) return ",";
  return null;
}

function normalizeHeader(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

function normalizeGender(value) {
  const gender = String(value || "")
    .trim()
    .toUpperCase();
  return gender === "M" || gender === "F" ? gender : null;
}

function parseDate(value) {
  const input = String(value || "").trim();
  if (!input) return null;
  if (/^\d+(\.\d+)?$/.test(input)) {
    const date = new Date(Date.UTC(1899, 11, 30) + Number(input) * 86400000);
    return date.toISOString().slice(0, 10);
  }
  const match = input.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (match) {
    const year = match[3].length === 2 ? `20${match[3]}` : match[3];
    return `${year}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  }
  return null;
}

function openVerification() {
  errorMessage.value = "";
  try {
    parseDelimited(rawText.value);
  } catch (error) {
    errorMessage.value = error.message;
    return;
  }
  if (parsedStudents.value.length === 0) {
    errorMessage.value = "Aucun élève valide détecté.";
    return;
  }
  step.value = "verify";
}

function backToPaste() {
  if (loading.value) return;
  errorMessage.value = "";
  step.value = "paste";
}

async function importStudents() {
  if (parsedStudents.value.length === 0 || loading.value) return;
  loading.value = true;
  errorMessage.value = "";

  try {
    const { data: existingClasses, error: classLoadError } = await supabase
      .from("tu_classes")
      .select("id, name");
    if (classLoadError) throw classLoadError;

    const classByName = new Map(
      (existingClasses || []).map((cls) => [String(cls.name).trim(), cls]),
    );
    const groups = [
      ...new Set(parsedStudents.value.map((student) => student.group)),
    ];
    const missingGroups = groups.filter((group) => !classByName.has(group));

    if (missingGroups.length > 0) {
      const { data: createdClasses, error: classInsertError } = await supabase
        .from("tu_classes")
        .insert(missingGroups.map((name) => ({ name, user_id: userId.value })))
        .select("id, name");
      if (classInsertError) throw classInsertError;
      for (const cls of createdClasses || [])
        classByName.set(String(cls.name).trim(), cls);
    }

    const studentsToInsert = parsedStudents.value.map((student) => ({
      firstname: student.firstname,
      lastname: student.lastname,
      gender: student.gender,
      birth_date: student.birthDate,
      record_number: student.recordNumber || null,
      student_number: student.studentNumber, // Will be null if not provided
      class_id: classByName.get(student.group)?.id,
      user_id: userId.value,
    }));

    // The server resolves permanent IDs and adds memberships atomically.
    const { data: insertedStudents, error: studentInsertError } =
      await supabase.rpc("tu_import_students", { rows: studentsToInsert });
    if (studentInsertError) throw studentInsertError;

    // Auto-assign student numbers for those without one
    const studentsNeedingNumbers = insertedStudents.filter(
      (s) => !s.student_number,
    );

    if (studentsNeedingNumbers.length > 0) {
      console.log(
        `Auto-assigning student numbers for ${studentsNeedingNumbers.length} students`,
      );

      // Group by class
      const byClass = {};
      for (const student of studentsNeedingNumbers) {
        if (!byClass[student.class_id]) {
          byClass[student.class_id] = [];
        }
        byClass[student.class_id].push(student);
      }

      // For each class, find the max existing student number and assign sequentially
      for (const [classId, students] of Object.entries(byClass)) {
        // Get existing students in this class to find max number
        const { data: existingStudents } = await supabase
          .from("tu_students")
          .select("student_number")
          .eq("class_id", classId)
          .not("student_number", "is", null);

        // Find max existing number
        let maxNumber = 0;
        if (existingStudents && existingStudents.length > 0) {
          const numbers = existingStudents
            .map((s) => parseInt(s.student_number))
            .filter((n) => !isNaN(n));
          if (numbers.length > 0) {
            maxNumber = Math.max(...numbers);
          }
        }

        console.log(`Class ${classId}: Starting from ${maxNumber + 1}`);

        // Assign sequential numbers
        for (let i = 0; i < students.length; i++) {
          const newNumber = String(maxNumber + i + 1).padStart(2, "0");

          const { error: updateError } = await supabase
            .from("tu_students")
            .update({ student_number: newNumber })
            .eq("id", students[i].id);

          if (updateError) {
            console.error(
              `Failed to update student number for ${students[i].id}:`,
              updateError,
            );
          } else {
            const { error: membershipError } = await supabase
              .from("tu_student_classes")
              .update({ student_number: newNumber })
              .eq("student_id", students[i].id)
              .eq("class_id", classId);
            if (membershipError) throw membershipError;
            console.log(
              `Assigned number ${newNumber} to student ${students[i].id}`,
            );
          }
        }
      }
    }

    rawText.value = "";
    step.value = "paste";
    emit("imported");
  } catch (error) {
    const details = [error?.message, error?.details, error?.hint, error?.code]
      .filter(Boolean)
      .join(" | ");
    console.error("Student import failed:", {
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      code: error?.code,
    });
    errorMessage.value = details || "Erreur lors de l'import. Réessayez.";
  } finally {
    loading.value = false;
  }
}

// ── Picture Import Functions ──────────────────────────

async function loadClasses() {
  try {
    const { data, error } = await supabase
      .from("tu_classes")
      .select("id, name")
      .order("name");
    if (error) throw error;
    classes.value = data || [];
  } catch (err) {
    console.error("Failed to load classes:", err);
    errorMessage.value = "Erreur lors du chargement des classes.";
  }
}

function handleFileSelect(event) {
  const files = Array.from(event.target.files || []).filter((file) => {
    const ext = file.name.split(".").pop().toLowerCase();
    return ["jpg", "jpeg", "png"].includes(ext);
  });
  selectedFiles.value = files;
}

function handleFileDrop(event) {
  const files = Array.from(event.dataTransfer.files || []).filter((file) => {
    const ext = file.name.split(".").pop().toLowerCase();
    return ["jpg", "jpeg", "png"].includes(ext);
  });
  selectedFiles.value = files;
}

function getFilePreview(file) {
  if (!filePreviews.has(file))
    filePreviews.set(file, URL.createObjectURL(file));
  return filePreviews.get(file);
}

function parseFilename(filename) {
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");

  console.log("  📝 Parsing filename:", nameWithoutExt);

  // Try format: "XXX-NN" or "XXX-0NN" (class-studentNumber) - strip leading zeros
  const classNumberMatch = nameWithoutExt.match(/^(\d+)-0*(\d+)$/);
  if (classNumberMatch) {
    const parsed = {
      type: "class-number",
      classIdentifier: classNumberMatch[1],
      studentNumber: String(parseInt(classNumberMatch[2])), // Strip leading zeros
    };
    console.log("  → Parsed as class-number:", parsed);
    return parsed;
  }

  // Try format with comma: "Lastname, Firstname" or "Firstname, Lastname"
  if (nameWithoutExt.includes(",")) {
    const parts = nameWithoutExt
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 2) {
      const parsed = {
        type: "comma-name",
        part1: parts[0],
        part2: parts[1],
      };
      console.log("  → Parsed as comma-name:", parsed);
      return parsed;
    }
  }

  // Try format: "Lastname_Firstname" or "Firstname_Lastname" or other separators
  const parts = nameWithoutExt.split(/[_\s-]+/).filter(Boolean);
  if (parts.length === 2) {
    const parsed = {
      type: "name",
      part1: parts[0],
      part2: parts[1],
    };
    console.log("  → Parsed as two-part name:", parsed);
    return parsed;
  } else if (parts.length === 1) {
    // Could be either firstname or lastname - we'll try both
    const parsed = {
      type: "single-name",
      name: parts[0],
    };
    console.log("  → Parsed as single-name:", parsed);
    return parsed;
  }

  const parsed = { type: "unknown", raw: nameWithoutExt };
  console.log("  → Parsed as unknown:", parsed);
  return parsed;
  const m = str1.length;
  const n = str2.length;
  const dp = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost =
        str1[i - 1].toLowerCase() === str2[j - 1].toLowerCase() ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[m][n];
}

async function matchStudentsToPictures() {
  loading.value = true;
  errorMessage.value = "";

  try {
    console.log(
      "🔍 Starting student matching for",
      selectedFiles.value.length,
      "files",
    );

    const students = await allRows(() =>
      supabase.from("tu_students").select("*").order("id"),
    );
    const memberships = await allRows(() =>
      supabase
        .from("tu_student_classes")
        .select("*")
        .order("student_id")
        .order("class_id"),
    );
    // Store all students for search
    allStudentsForSearch.value = students || [];

    const matched = [];
    const unmatched = [];

    for (const file of selectedFiles.value) {
      const parsed = parseFilename(file.name);
      console.log("📄 Processing file:", file.name, "→ Parsed as:", parsed);

      let studentMatch = null;
      let candidates = photoCandidates(file.name, students);

      if (parsed.type === "class-number") {
        console.log(
          "  → Trying class-number match (stripped):",
          parsed.classIdentifier + "-" + parsed.studentNumber,
        );
        const matchingClass = classes.value.find(
          (c) => String(c.name) === parsed.classIdentifier,
        );
        const numberMatches = students.filter(
          (s) =>
            matchingClass &&
            memberships.some(
              (m) =>
                m.class_id === matchingClass.id &&
                m.student_id === s.id &&
                String(
                  parseInt(
                    m.student_number ||
                      (s.class_id === m.class_id ? s.student_number : null),
                  ),
                ) === parsed.studentNumber,
            ),
        );
        candidates = numberMatches.map((student) => ({ student, score: 100 }));
        studentMatch = numberMatches.length === 1 ? numberMatches[0] : null;
        if (studentMatch) {
          console.log(
            "  ✅ Found match by student number:",
            studentMatch.firstname,
            studentMatch.lastname,
          );
        } else {
          console.log("  ❌ No match found by student number");
        }
      } else {
        studentMatch = findStudentByFilename(file.name, students);
        if (studentMatch) {
          console.log(
            "  ✅ Found unique name match:",
            studentMatch.firstname,
            studentMatch.lastname,
          );
        } else {
          console.log("  ❌ No unique name match found");
        }
      }

      if (studentMatch) {
        matched.push({
          file,
          student: studentMatch,
          parsed,
          manualMatch: false,
        });
      } else {
        console.log("  ➕ Added to unmatched list");
        unmatched.push({
          file,
          student: null,
          candidates: candidates.slice(0, 6),
          parsed,
          manualMatch: false,
        });
      }
    }

    console.log(
      "📊 Matching complete:",
      matched.length,
      "matched,",
      unmatched.length,
      "unmatched",
    );
    matchedStudents.value = [...matched, ...unmatched];
    pictureStep.value = "match";
  } catch (err) {
    console.error("Failed to match students:", err);
    errorMessage.value = "Erreur lors de la correspondance des élèves.";
  } finally {
    loading.value = false;
  }
}

function updateManualMatch(index, studentId) {
  if (studentId) {
    // Find the full student object from allStudentsForSearch
    const student = allStudentsForSearch.value.find((s) => s.id === studentId);
    if (student) {
      matchedStudents.value[index].student = student;
      matchedStudents.value[index].manualMatch = true;
      console.log("✅ Manually matched:", student.firstname, student.lastname);
    }
  }
}

function removeStudentMatch(index) {
  matchedStudents.value[index].student = null;
  matchedStudents.value[index].manualMatch = false;
  // Clear the search filter for this index
  delete studentSearchFilters.value[index];
  console.log("❌ Removed student match at index", index);
}

async function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target.result;
    };

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      // Calculate new dimensions (256px width, maintain aspect ratio)
      const maxWidth = 256;
      const scale = maxWidth / img.width;
      const newWidth = maxWidth;
      const newHeight = img.height * scale;

      canvas.width = newWidth;
      canvas.height = newHeight;

      // Draw and compress
      ctx.drawImage(img, 0, 0, newWidth, newHeight);

      // Convert to JPG at 40% quality
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(
              new File([blob], `${file.name}.jpg`, { type: "image/jpeg" }),
            );
          } else {
            reject(new Error("Compression failed"));
          }
        },
        "image/jpeg",
        0.4,
      );
    };

    img.onerror = () => reject(new Error("Failed to load image"));
    reader.readAsDataURL(file);
  });
}

async function uploadPictures() {
  const studentsToUpload = matchedStudents.value.filter((m) => m.student);

  if (studentsToUpload.length === 0) {
    errorMessage.value = "Aucun élève sélectionné pour l'import.";
    return;
  }

  loading.value = true;
  errorMessage.value = "";
  uploadResults.value = [];

  try {
    for (const match of studentsToUpload) {
      try {
        // Compress image
        const compressedFile = await compressImage(match.file);

        // Get a short-lived PUT URL from the PHP backend.
        // Use /api/ prefix for local dev (proxied by Vite), full path for production
        const apiUrl = import.meta.env.DEV
          ? "/api/generate-presigned-url.php"
          : import.meta.env.BASE_URL + "api/generate-presigned-url.php";

        const signatureData = new FormData();
        signatureData.append("studentId", match.student.id);
        signatureData.append("filename", compressedFile.name);
        signatureData.append("content_type", compressedFile.type);

        const response = await fetch(apiUrl, {
          method: "POST",
          body: signatureData,
        });

        const responseData = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(
            responseData?.error ||
              `Failed to get upload URL: ${response.statusText}`,
          );
        }

        const { success, url, filename, publicUrl } = responseData || {};
        if (!success || !url || !filename || !publicUrl) {
          throw new Error("Invalid upload URL response");
        }

        console.log("Upload URL response:", {
          studentId: match.student.id,
          filename,
          publicUrl: publicUrl,
        });

        // The signed Content-Type must match the header sent with the PUT.
        const uploadResponse = await fetch(url, {
          method: "PUT",
          headers: { "Content-Type": compressedFile.type },
          body: compressedFile,
        });

        if (!uploadResponse.ok && uploadResponse.status !== 204) {
          throw new Error(`Upload failed: ${uploadResponse.statusText}`);
        }

        // Update student record with photo URL
        console.log("Updating student photo_url:", {
          studentId: match.student.id,
          studentName: `${match.student.firstname} ${match.student.lastname}`,
          publicUrl: publicUrl,
        });

        const { error: updateError, data: updateData } = await supabase
          .from("tu_students")
          .update({ photo_url: publicUrl })
          .eq("id", match.student.id)
          .select();

        if (updateError) {
          console.error("Failed to update photo_url in Supabase:", updateError);
          throw updateError;
        }

        console.log("Successfully updated photo_url for student:", updateData);

        uploadResults.value.push({
          student: match.student,
          file: match.file,
          success: true,
          url: publicUrl,
        });
      } catch (err) {
        console.error(`Failed to upload photo for ${match.file.name}:`, err);
        uploadResults.value.push({
          student: match.student,
          file: match.file,
          success: false,
          error: err.message,
        });
      }
    }

    pictureStep.value = "results";
    if (uploadResults.value.some((result) => result.success)) {
      emit("photos-imported");
    }
  } catch (err) {
    console.error("Upload failed:", err);
    errorMessage.value = "Erreur lors de l'import des photos.";
  } finally {
    loading.value = false;
  }
}

function resetPictureImport() {
  selectedFiles.value = [];
  selectedClassId.value = null;
  matchedStudents.value = [];
  uploadResults.value = [];
  pictureStep.value = "select";
  errorMessage.value = "";
  emit("close");
}

function close() {
  if (loading.value) return;

  if (importType.value === "pictures") {
    resetPictureImport();
  } else {
    rawText.value = "";
    errorMessage.value = "";
    step.value = "paste";
  }

  importType.value = null;
  emit("close");
}
</script>

<template>
  <Popup :show="true" title="" @close="close">
    <div class="student-import-content">
      <!-- Import Type Selection -->
      <div v-if="!importType" class="import-type-selection">
        <p class="import-type-description">
          Choisissez le type d'import que vous souhaitez effectuer :
        </p>
        <div class="import-type-options">
          <button class="import-type-option" @click="importType = 'students'">
            <FileText :size="48" />
            <span>Importer des élèves (CSV)</span>
            <small>Coller des données depuis Excel</small>
          </button>
          <button
            class="import-type-option"
            @click="
              importType = 'pictures';
              loadClasses();
            "
          >
            <ImageIcon :size="48" />
            <span>Importer des photos</span>
            <small>Photos d'élèves par lots</small>
          </button>
        </div>
      </div>

      <!-- Students Import (existing) -->
      <div v-else-if="importType === 'students'">
        <div v-if="step === 'paste'" class="student-import-paste-step">
          <label class="student-import-label" for="student-import-text"
            >Collez les lignes copiées depuis Excel</label
          >
          <textarea
            id="student-import-text"
            v-model="rawText"
            class="student-import-textarea"
            ref="pasteArea"
            :style="{ height: `${preferences.pasteHeight}px` }"
            autofocus
            placeholder="Groupe\tNom de l'élève\tSexe\tDate de naissance"
          ></textarea>
        </div>

        <div v-else class="student-import-verify-step">
          <div class="student-import-mapping">
            <div
              v-for="field in [
                { key: 'group', label: 'Groupe' },
                { key: 'name', label: 'Nom de l\'élève' },
                { key: 'studentNumber', label: 'Numéro (optionnel)' },
                { key: 'recordNumber', label: 'Fiche permanente (optionnel)' },
                { key: 'gender', label: 'Sexe' },
                { key: 'birthDate', label: 'Date de naissance' },
              ]"
              :key="field.key"
              class="student-import-field"
            >
              <label :for="`import-${field.key}`">{{ field.label }}</label>
              <PopupSelect
                :id="`import-${field.key}`"
                v-model.number="columnMap[field.key]"
              >
                <option
                  v-for="(header, index) in headers"
                  :key="index"
                  :value="index"
                >
                  {{ header }}
                </option>
                <option :value="-1">Ignorer</option>
              </PopupSelect>
            </div>
          </div>

          <div v-if="previewRows.length > 0" class="student-import-preview">
            <div class="student-import-summary">
              {{ parsedStudents.length }} élève(s), {{ groupCount }} classe(s)
            </div>
            <div class="student-import-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Groupe</th>
                    <th>N°</th>
                    <th>Nom de l'élève</th>
                    <th>Sexe</th>
                    <th>Date de naissance</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(student, index) in previewRows" :key="index">
                    <td>{{ student.group }}</td>
                    <td>{{ student.studentNumber || "—" }}</td>
                    <td>{{ student.firstname }} {{ student.lastname }}</td>
                    <td>{{ student.gender || "-" }}</td>
                    <td>{{ student.birthDate || "-" }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <p v-if="errorMessage" class="student-import-error">
          {{ errorMessage }}
        </p>

        <div class="student-import-actions">
          <button
            v-if="step === 'verify'"
            class="student-import-back"
            :disabled="loading"
            @click="backToPaste"
          >
            <ArrowLeft :size="18" /> Retour
          </button>
          <button
            v-else
            class="student-import-cancel"
            :disabled="loading"
            @click="close"
          >
            Annuler
          </button>
          <button
            v-if="step === 'paste'"
            class="student-import-submit"
            :disabled="loading || !rawText.trim()"
            @click="openVerification"
          >
            Vérifier
          </button>
          <button
            v-else
            class="student-import-submit"
            :disabled="loading || parsedStudents.length === 0"
            @click="importStudents"
          >
            <Upload :size="18" />{{ loading ? "Import…" : "Importer" }}
          </button>
        </div>
      </div>

      <!-- Pictures Import -->
      <div v-else-if="importType === 'pictures'">
        <!-- Step 1: Select files -->
        <div v-if="pictureStep === 'select'" class="picture-import-step">
          <label class="student-import-label"
            >Sélectionnez les photos (JPG/PNG)</label
          >
          <div
            v-if="selectedFiles.length === 0"
            class="file-drop-zone"
            @dragover.prevent
            @drop.prevent="handleFileDrop"
          >
            <input
              type="file"
              id="picture-files"
              multiple
              accept=".jpg,.jpeg,.png"
              @change="handleFileSelect"
              class="file-input"
            />
            <label for="picture-files" class="file-drop-label">
              <ImageIcon :size="48" />
              <span>Cliquez ou glissez-déposez les fichiers ici</span>
              <small>JPG et PNG uniquement</small>
            </label>
          </div>
          <div v-if="selectedFiles.length > 0" class="selected-files-preview">
            <p>{{ selectedFiles.length }} fichier(s) sélectionné(s)</p>
            <ul>
              <li v-for="(file, idx) in selectedFiles.slice(0, 5)" :key="idx">
                {{ file.name }}
              </li>
              <li v-if="selectedFiles.length > 5">
                ... et {{ selectedFiles.length - 5 }} autre(s)
              </li>
            </ul>
            <!-- Thumbnails -->
            <div class="thumbnail-grid">
              <div
                v-for="(file, idx) in selectedFiles.slice(0, 20)"
                :key="idx"
                class="thumbnail-item"
              >
                <img :src="getFilePreview(file)" :alt="file.name" />
                <span class="thumbnail-name">{{ file.name }}</span>
              </div>
              <div v-if="selectedFiles.length > 20" class="thumbnail-more">
                +{{ selectedFiles.length - 20 }} plus
              </div>
            </div>
          </div>
        </div>

        <!-- Step 2: Match students (auto-detect, no class selection) -->
        <div
          v-else-if="pictureStep === 'match'"
          class="picture-import-step picture-match-step"
        >
          <div class="match-list">
            <div
              v-for="(match, index) in matchedStudents"
              :key="index"
              class="match-item"
              :class="{ matched: match.student, unmatched: !match.student }"
            >
              <!-- Thumbnail -->
              <div class="match-thumbnail">
                <img :src="getFilePreview(match.file)" :alt="match.file.name" />
              </div>
              <div class="match-file-info">
                <span class="match-filename">{{ match.file.name }}</span>
                <span
                  v-if="match.parsed.type === 'class-number'"
                  class="match-hint"
                >
                  Format: Classe {{ match.parsed.classIdentifier }}-{{
                    match.parsed.studentNumber
                  }}
                </span>
                <span
                  v-else-if="
                    match.parsed.type === 'comma-name' ||
                    match.parsed.type === 'name'
                  "
                  class="match-hint"
                >
                  Noms: "{{ match.parsed.part1 }}" et "{{ match.parsed.part2 }}"
                </span>
                <span
                  v-else-if="match.parsed.type === 'single-name'"
                  class="match-hint"
                >
                  Nom: {{ match.parsed.name }}
                </span>
              </div>
              <div class="match-student-info">
                <label v-if="!match.student && match.candidates?.length"
                  >Choisir parmi les correspondances<PopupSelect
                    @change="updateManualMatch(index, $event.target.value)"
                  >
                    <option value="">Choisir un élève</option>
                    <option
                      v-for="candidate in match.candidates"
                      :key="candidate.student.id"
                      :value="candidate.student.id"
                    >
                      {{ candidate.student.firstname }}
                      {{ candidate.student.lastname }} ·
                      {{
                        candidate.student.record_number ||
                        candidate.student.student_number ||
                        "Sans numéro"
                      }}
                      ·
                      {{
                        classes.find((c) => c.id === candidate.student.class_id)
                          ?.name
                      }}
                    </option>
                  </PopupSelect></label
                >
                <template v-if="match.student">
                  <span class="match-success"
                    >✓ {{ match.student.firstname }}
                    {{ match.student.lastname }}</span
                  >
                  <button
                    class="remove-match-button"
                    title="Retirer l'élève et rechercher un autre"
                    @click="removeStudentMatch(index)"
                  >
                    <X :size="16" />
                  </button>
                </template>
                <template v-else>
                  <div class="student-search-container">
                    <input
                      type="text"
                      class="student-search-input"
                      placeholder="Rechercher un élève..."
                      :value="studentSearchFilters[index] || ''"
                      @input="studentSearchFilters[index] = $event.target.value"
                    />
                    <div
                      v-if="
                        getFilteredStudents(studentSearchFilters[index])
                          .length > 0
                      "
                      class="student-search-results"
                    >
                      <div
                        v-for="student in getFilteredStudents(
                          studentSearchFilters[index],
                        )"
                        :key="student.id"
                        class="student-search-result-item"
                        @click="updateManualMatch(index, student.id)"
                      >
                        <span class="student-name"
                          >{{ student.firstname }} {{ student.lastname }}</span
                        >
                        <span v-if="student.className" class="student-class">{{
                          student.className
                        }}</span>
                      </div>
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 4: Upload results -->
        <div v-else-if="pictureStep === 'results'" class="picture-import-step">
          <div class="upload-results">
            <h3>Résultats de l'import</h3>
            <div class="results-summary">
              <p>
                Succès: {{ uploadResults.filter((r) => r.success).length }} |
                Échecs: {{ uploadResults.filter((r) => !r.success).length }}
              </p>
            </div>
            <div class="results-list">
              <div
                v-for="(result, index) in uploadResults"
                :key="index"
                class="result-item"
                :class="{ success: result.success, failed: !result.success }"
              >
                <span>{{ result.file.name }}</span>
                <span v-if="result.success">✓ Importé</span>
                <span v-else class="error-text">✗ {{ result.error }}</span>
              </div>
            </div>
          </div>
        </div>

        <p v-if="errorMessage" class="student-import-error">
          {{ errorMessage }}
        </p>

        <div class="student-import-actions">
          <button
            v-if="pictureStep === 'match'"
            class="student-import-back"
            :disabled="loading"
            @click="pictureStep = 'select'"
          >
            <ArrowLeft :size="18" /> Retour
          </button>
          <button
            v-else-if="pictureStep !== 'results'"
            class="student-import-cancel"
            :disabled="loading"
            @click="resetPictureImport"
          >
            Annuler
          </button>
          <button
            v-if="pictureStep === 'select'"
            class="student-import-submit"
            :disabled="loading || selectedFiles.length === 0"
            @click="matchStudentsToPictures"
          >
            Correspondre les élèves
          </button>
          <button
            v-else-if="pictureStep === 'match'"
            class="student-import-submit"
            :disabled="
              loading || matchedStudents.filter((m) => m.student).length === 0
            "
            @click="uploadPictures"
          >
            <Upload :size="18" />{{ loading ? "Import…" : "Importer" }}
          </button>
          <button
            v-else-if="pictureStep === 'results'"
            class="student-import-submit"
            @click="close"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  </Popup>
</template>

<style scoped>
.student-import-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}
.student-import-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
.student-import-paste-step,
.student-import-verify-step {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}
.student-import-paste-step .student-import-label {
  flex: 0 0 auto;
}
.student-import-mapping {
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.55rem;
  margin-top: 0.9rem;
}
.student-import-field select {
  padding: 0.5rem;
  font-size: 0.8rem;
}
.student-import-preview {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  margin-top: 1rem;
}
.student-import-summary {
  margin-bottom: 0.45rem;
  font-size: 0.82rem;
  font-weight: 700;
}
.student-import-table-wrap {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 9px;
}
.student-import-table-wrap table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.78rem;
  background: var(--surface);
}
.student-import-table-wrap th,
.student-import-table-wrap td {
  padding: 0.45rem 0.55rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  text-align: left;
}
.student-import-table-wrap th {
  position: sticky;
  top: 0;
  background: var(--surface);
}
.student-import-empty,
.student-import-error {
  font-size: 0.82rem;
  opacity: 0.8;
}
.student-import-error {
  color: #ffb4a2;
}
.student-import-actions {
  flex: 0 0 auto;
  justify-content: flex-end;
  margin-top: 1rem;
  position: sticky;
  bottom: 0;
  background: var(--surface);
  padding-top: 1rem;
  border-top: 1px solid #e0e0e0;
  z-index: 10;
}
.student-import-cancel {
  background: rgba(255, 255, 255, 0.08);
}
.student-import-submit {
  background: var(--stadium-yellow);
  color: var(--text-light);
  font-weight: 700;
}
.student-import-submit:disabled,
.student-import-cancel:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}
@media (max-width: 700px) {
  .student-import-modal {
    width: 94%;
    height: 88%;
    max-height: 88%;
  }

  .student-import-mapping {
    grid-template-columns: 1fr 1fr;
  }
}

/* Import Type Selection */
.import-type-selection {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2rem;
}

.import-type-description {
  font-size: 1.1rem;
  color: #555;
  text-align: center;
}

.import-type-options {
  display: flex;
  gap: 2rem;
  flex-wrap: wrap;
  justify-content: center;
}

.import-type-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 2rem 2.5rem;
  border: 2px solid #e0e0e0;
  border-radius: 16px;
  background: var(--surface);
  cursor: pointer;
  transition: all 0.2s;
  min-width: 200px;
}

.import-type-option:focus-visible {
  border-color: #4a90d9;
  background: #e8f0fe;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(74, 144, 217, 0.2);
}

.import-type-option span {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-light);
}

.import-type-option small {
  font-size: 0.85rem;
  color: #666;
  text-align: center;
}

/* Picture Import Steps */
.picture-import-step {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-height: calc(80vh - 200px);
}

/* File Drop Zone */
.file-drop-zone {
  position: relative;
  border: 2px dashed #ccc;
  border-radius: 12px;
  padding: 3rem 2rem;
  text-align: center;
  transition: all 0.2s;
  background: var(--surface);
  flex-shrink: 0;
}

.file-drop-zone:focus-visible {
  border-color: #4a90d9;
  background: #e8f0fe;
}

.file-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.file-drop-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  pointer-events: none;
}

.file-drop-label span {
  font-size: 1.1rem;
  font-weight: 600;
  color: #555;
}

.file-drop-label small {
  font-size: 0.85rem;
  color: #888;
}

.selected-files-preview {
  margin-top: 1rem;
  padding: 1rem;
  background: #f0f0f0;
  border-radius: 8px;
  overflow: visible;
  max-height: 500px;
  overflow-y: auto;
}

.selected-files-preview p {
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.selected-files-preview ul {
  list-style: none;
  padding: 0;
  margin: 0;
  font-size: 0.9rem;
  color: #666;
  display: none; /* Hide text list, show thumbnails instead */
}

/* Thumbnail Grid */
.thumbnail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 10px;
  margin-top: 1rem;
  max-height: 350px;
  overflow-y: auto;
  padding: 8px;
}

.thumbnail-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 6px;
  background: var(--surface);
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  min-width: 0;
}

.thumbnail-item img {
  width: 100%;
  height: 80px;
  object-fit: cover;
  border-radius: 6px;
  background: #f0f0f0;
}

.thumbnail-name {
  font-size: 0.7rem;
  color: #666;
  text-align: center;
  word-break: break-word;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.thumbnail-more {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 80px;
  font-size: 1rem;
  font-weight: 600;
  color: #666;
  background: #f0f0f0;
  border-radius: 8px;
}

/* Class Select */
.student-import-select {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1.5px solid #ddd;
  border-radius: 8px;
  font-size: 1rem;
  background: var(--surface);
  cursor: pointer;
}

.student-import-select:focus {
  outline: none;
  border-color: #4a90d9;
}

/* Match List */
.picture-match-step {
  gap: 0.75rem;
  height: 100vh;
}

.match-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.match-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border-radius: 8px;
  background: var(--surface);
  border: 1px solid #e0e0e0;
}

.match-thumbnail {
  flex-shrink: 0;
  width: 60px;
  height: 60px;
  border-radius: 6px;
  overflow: hidden;
  background: var(--surface);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.match-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.match-item.matched {
  background: #e8f5e9;
  border-color: #4caf50;
}

.match-item.unmatched {
  background: #fff3e0;
  border-color: #ff9800;
}

.match-file-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.match-filename {
  font-weight: 600;
  color: var(--text-light);
}

.match-hint {
  font-size: 0.85rem;
  color: #666;
  font-style: italic;
}
.match-item {
  overflow: visible;
}
.match-student-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.match-success {
  color: #2e7d32;
  font-weight: 600;
}

.remove-match-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.35rem;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #c62828;
  cursor: pointer;
  transition: all 0.15s;
}

.remove-match-button:focus-visible {
  background: rgba(198, 40, 40, 0.1);
}

.remove-match-button:active {
  transform: scale(0.95);
}

.match-manual {
  font-size: 0.75rem;
  color: #666;
  font-style: italic;
}

.student-search-select {
  padding: 0.5rem;
  border: 1.5px solid #ddd;
  border-radius: 6px;
  font-size: 0.9rem;
  min-width: 200px;
}

/* Student Search Container */
.student-search-container {
  position: relative;
  width: 100%;
  max-width: 300px;
}

.student-search-input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1.5px solid #ddd;
  border-radius: 6px;
  font-size: 0.9rem;
  outline: none;
}

.student-search-input:focus {
  border-color: #4a90d9;
}

.student-search-results {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  max-height: 200px;
  overflow-y: auto;
  background: white;
  border: 1px solid #ddd;
  border-radius: 6px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  z-index: 10;
}

.student-search-result-item {
  /* position: absolute; */
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  transition: background 0.15s;
}

.student-search-result-item .student-name {
  font-weight: 500;
  color: var(--text-light);
}

.student-search-result-item .student-class {
  font-size: 0.8rem;
  color: #666;
}

/* Upload Results */
.upload-results {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.upload-results h3 {
  margin: 0;
  font-size: 1.2rem;
  color: var(--text-light);
}

.results-summary {
  padding: 1rem;
  background: #f0f0f0;
  border-radius: 8px;
  font-weight: 600;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 300px;
  overflow-y: auto;
}

.result-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  background: var(--surface);
  font-size: 0.9rem;
}

.result-item.success {
  background: #e8f5e9;
  color: #2e7d32;
}

.result-item.failed {
  background: #ffebee;
  color: #c62828;
}

.error-text {
  font-size: 0.85rem;
}

.student-import-textarea {
  width: 100%;
  min-height: 180px;
  max-height: 55dvh;
  resize: vertical;
  overflow: auto;
  white-space: pre;
  font-family: monospace;
  padding: 0.75rem;
  background: var(--surface);
  color: var(--text-light);
  border: 1px solid var(--border-color);
  border-radius: 8px;
}
.student-import-field {
  display: grid;
  grid-template-rows: minmax(2.5em, auto) auto;
  gap: 0.3rem;
  min-width: 0;
}
.student-import-field select {
  width: 100%;
  min-width: 0;
}
</style>
