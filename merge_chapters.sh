#!/bin/bash

# Check if a path is provided
if [ -z "$1" ]; then
    echo "Please provide a path as a parameter."
    exit 1
fi

# Store the path in a variable
path=$1

# Check if the provided path exists
if [ ! -d "$path" ]; then
    echo "The provided path does not exist."
    exit 1
fi

# Perform operations on the provided path
echo "Processing files in: $path"

  # Extract the folder name
  folder_name=$(basename "$path")
  echo "$path"

# Find all MKV files in the specified directory
  mkv_files=$(find "$path" -type f -name "*.mp4" -print0 | sort -z | tr '\0' ' ' | sed 's/ $//' | sed 's/ / + /g')
  mkv_files="${mkv_files# + }"  # Remove leading space and plus sign

# Find all MKV files recursively in the input directory and add them to the array
while IFS= read -r -d '' file; do
    [[ -f $file ]] && file_list+=("$file")
done < <(find "$path" -type f -name "*.mp4" -print0 | sort -z)

# Check if any files were found
if [[ ${#file_list[@]} -eq 0 ]]; then
    echo "No MKV files found in the input directory."
    exit 1
fi

  # Loop through the file list and extract a section of the filename as the chapter name
  for file in "${mkv_files[@]}"; do
      filename=$(basename "$file")
      chapter_name=${filename#*-}  # Extract from the first "-" until the end
      chapter_name=${chapter_name//-/ }  # Replace "-" with spaces
      chapter_names+=("$chapter_name")
  done

  # Join the chapter names into a single string for the chapter names argument
  chapter_names_arg=$(IFS=":"; echo "${chapter_names[*]}")

  mkvmerge -o "$path/$folder_name.mkv" --generate-chapters when-appending --generate-chapters-name-template "<FILE_NAME>" $mkv_files

  echo "Merged MKV file: $path/$folder_name.mkv"

  chapter_file="chapter.xml"
  mkvextract "$path/$folder_name.mkv" chapters "$chapter_file"

  # Replace "-" with spaces in the chapter XML
  sed -i '' -E 's/(<ChapterString>).{5}(.*)(<\/ChapterString>)/\1\2\3/' "$chapter_file"
  sed -i '' -E '/<ChapterString>/,/<\/ChapterString>/ s/-/ /g' "$chapter_file"

  # Update the modified chapter XML using mkvpropedit
  mkvpropedit "$path/$folder_name.mkv" --chapters "$chapter_file"
