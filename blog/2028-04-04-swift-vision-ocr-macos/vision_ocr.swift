// Apple Vision OCR — high-accuracy text recognition for scanned documents.
// Usage: swift vision_ocr.swift <image1> [image2 ...]
// Prints recognized text for each image to stdout, separated by page markers.

import Foundation
import Vision
import AppKit

func ocr(_ path: String) -> String {
    guard let image = NSImage(contentsOfFile: path),
          let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
        return "[ERROR: could not load image \(path)]"
    }

    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate          // best quality (not .fast)
    request.usesLanguageCorrection = true
    request.recognitionLanguages = ["en-US"]
    // Use the newest revision available for best accuracy.
    if #available(macOS 13.0, *) {
        request.revision = VNRecognizeTextRequestRevision3
    }

    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    do {
        try handler.perform([request])
    } catch {
        return "[ERROR: OCR failed on \(path): \(error)]"
    }

    guard let observations = request.results else { return "" }

    // Preserve reading order top-to-bottom, then left-to-right.
    let lines = observations
        .sorted { a, b in
            // Vision y-origin is bottom-left; higher y = higher on page.
            if abs(a.boundingBox.midY - b.boundingBox.midY) > 0.012 {
                return a.boundingBox.midY > b.boundingBox.midY
            }
            return a.boundingBox.midX < b.boundingBox.midX
        }
        .compactMap { $0.topCandidates(1).first?.string }

    return lines.joined(separator: "\n")
}

let args = Array(CommandLine.arguments.dropFirst())
for path in args {
    let name = (path as NSString).lastPathComponent
    print("===== \(name) =====")
    print(ocr(path))
    print("")
}
