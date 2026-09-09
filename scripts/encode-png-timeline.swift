import AVFoundation
import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

func fail(_ message: String) -> Never {
  FileHandle.standardError.write(Data((message + "\n").utf8))
  exit(1)
}

guard CommandLine.arguments.count >= 4 else {
  fail("Usage: encode-png-timeline.swift <frames-dir> <output.mp4> <fps>")
}

let framesDirectory = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2])
guard let fps = Int32(CommandLine.arguments[3]), fps > 0 else { fail("fps must be positive") }

let frameURLs = (try? FileManager.default.contentsOfDirectory(
  at: framesDirectory,
  includingPropertiesForKeys: nil,
  options: [.skipsHiddenFiles]
))?.filter { $0.lastPathComponent.contains("frame-") && $0.pathExtension.lowercased() == "png" }
  .sorted { $0.lastPathComponent < $1.lastPathComponent } ?? []

guard let firstURL = frameURLs.first,
      let firstSource = CGImageSourceCreateWithURL(firstURL as CFURL, nil),
      let firstImage = CGImageSourceCreateImageAtIndex(firstSource, 0, nil) else {
  fail("No readable *frame-*.png files in \(framesDirectory.path)")
}

if outputURL.pathExtension.lowercased() == "gif" {
  try? FileManager.default.removeItem(at: outputURL)
  guard let destination = CGImageDestinationCreateWithURL(
    outputURL as CFURL,
    UTType.gif.identifier as CFString,
    frameURLs.count,
    nil
  ) else { fail("Cannot create GIF destination") }
  let frameDelay = 1.0 / Double(fps)
  let frameProperties = [kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFDelayTime: frameDelay]] as CFDictionary
  let fileProperties = [kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFLoopCount: 0]] as CFDictionary
  CGImageDestinationSetProperties(destination, fileProperties)
  for frameURL in frameURLs {
    guard let source = CGImageSourceCreateWithURL(frameURL as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
      fail("Cannot decode \(frameURL.lastPathComponent)")
    }
    CGImageDestinationAddImage(destination, image, frameProperties)
  }
  guard CGImageDestinationFinalize(destination) else { fail("Cannot finalize GIF") }
  print("Encoded \(frameURLs.count) frames to \(outputURL.path)")
  exit(0)
}

try? FileManager.default.removeItem(at: outputURL)
let useQuickTimeJPEG = outputURL.pathExtension.lowercased() == "mov"
let writer = try AVAssetWriter(outputURL: outputURL, fileType: useQuickTimeJPEG ? .mov : .mp4)
let settings: [String: Any] = [
  AVVideoCodecKey: useQuickTimeJPEG ? AVVideoCodecType.proRes422 : AVVideoCodecType.h264,
  AVVideoWidthKey: firstImage.width,
  AVVideoHeightKey: firstImage.height,
]
let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
input.expectsMediaDataInRealTime = false
let attributes: [String: Any] = [
  kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
  kCVPixelBufferWidthKey as String: firstImage.width,
  kCVPixelBufferHeightKey as String: firstImage.height,
]
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: attributes)
guard writer.canAdd(input) else { fail("Cannot add video input") }
writer.add(input)
guard writer.startWriting() else { fail(writer.error?.localizedDescription ?? "Cannot start writer") }
writer.startSession(atSourceTime: .zero)

func pixelBuffer(from image: CGImage) -> CVPixelBuffer? {
  var buffer: CVPixelBuffer?
  let status = CVPixelBufferCreate(
    kCFAllocatorDefault,
    image.width,
    image.height,
    kCVPixelFormatType_32BGRA,
    nil,
    &buffer
  )
  guard status == kCVReturnSuccess, let buffer else { return nil }
  CVPixelBufferLockBaseAddress(buffer, [])
  defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
  guard let context = CGContext(
    data: CVPixelBufferGetBaseAddress(buffer),
    width: image.width,
    height: image.height,
    bitsPerComponent: 8,
    bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
    space: CGColorSpaceCreateDeviceRGB(),
    bitmapInfo: CGBitmapInfo.byteOrder32Little.rawValue | CGImageAlphaInfo.premultipliedFirst.rawValue
  ) else { return nil }
  context.translateBy(x: 0, y: CGFloat(image.height))
  context.scaleBy(x: 1, y: -1)
  context.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
  return buffer
}

for (index, frameURL) in frameURLs.enumerated() {
  while !input.isReadyForMoreMediaData { Thread.sleep(forTimeInterval: 0.01) }
  guard let source = CGImageSourceCreateWithURL(frameURL as CFURL, nil),
        let image = CGImageSourceCreateImageAtIndex(source, 0, nil),
        let buffer = pixelBuffer(from: image) else {
    fail("Cannot decode \(frameURL.lastPathComponent)")
  }
  let time = CMTime(value: Int64(index), timescale: fps)
  guard adaptor.append(buffer, withPresentationTime: time) else {
    fail(writer.error?.localizedDescription ?? "Cannot append frame \(index)")
  }
}

input.markAsFinished()
let semaphore = DispatchSemaphore(value: 0)
writer.finishWriting { semaphore.signal() }
semaphore.wait()
guard writer.status == .completed else { fail(writer.error?.localizedDescription ?? "Video encoding failed") }
print("Encoded \(frameURLs.count) frames to \(outputURL.path)")
