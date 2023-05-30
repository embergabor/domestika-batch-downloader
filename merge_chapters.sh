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

  mkvmerge -o "$path/$folder_name.mkv" --generate-chapters when-appending --generate-chapters-name-template "<FILE_NAME>" $mkv_files

  chapter_file="$path/chapter.xml"
  mkvextract "$path/$folder_name.mkv" chapters "$chapter_file"

  # Get the lesson title as chapter name and replace "-" with spaces
  sed -i '' -E 's/(<ChapterString>).{5}(.*)(<\/ChapterString>)/\1\2\3/' "$chapter_file"
  sed -i '' -E '/<ChapterString>/,/<\/ChapterString>/ s/-/ /g' "$chapter_file"

  # Update the modified chapter XML using mkvpropedit
  mkvpropedit "$path/$folder_name.mkv" --chapters "$chapter_file"

  echo "Merged MKV file: $path/$folder_name.mkv"
