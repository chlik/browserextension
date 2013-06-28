if ( !exports ) var exports = {};
(function(S) {

var PriceDetector = function(boundaryValue, charModels) {
  this.boundaryValue = boundaryValue
  this.charModels = charModels
}

PriceDetector.prototype = {
  VALID_PIXEL_FLAG: 1,
  INVALID_PIXEL_FLAG: 0,

  convertGrey: function(imageData) {
    for (var x = 0; x < imageData.width; x++) {
      for (var y = 0; y < imageData.height; y++) {
        var i = x * 4 + y * 4 * imageData.width;
        var luma = Math.floor(imageData.data[i] * 299 / 1000 +
          imageData.data[i + 1] * 587 / 1000 +
          imageData.data[i + 2] * 114 / 1000)
        imageData.data[i] = luma
        imageData.data[i + 1] = luma
        imageData.data[i + 2] = luma
        imageData.data[i + 3] = 255
      }
    }
    return imageData
  },

  binarizate: function(imageData) {
    var boundaryValue = this.boundaryValue
    var data = imageData.data
    var w = imageData.width
    var h = imageData.height
    var l = w * h
    var result = []

    for (var i = 0, j; i < l; i++) {
      j = i * 4;
      
      if (data[j] < boundaryValue) {
        result.push(this.VALID_PIXEL_FLAG)
      } else {
        result.push(this.INVALID_PIXEL_FLAG)
      }
    }

    return result
  },

  splitChars: function(imageData, width) {
    var l = imageData.length
    var height = l / width
    var splitLine
    var splitLineIndex = []
    var result = []
    var x, y, i

    // 先找出所有分割线：矩阵 y 方向上的点全部为 0
    for (x = 0; x < width; x++) {
      splitLine = true;
      for (y = 0; y < height; y++) {
        i = x + y * width
        if (imageData[i] == this.VALID_PIXEL_FLAG) {
          splitLine = false
          break
        }
      }

      if (splitLine) {
        splitLineIndex.push(x)
      }
    }

    // 切割字符
    var indexSize = splitLineIndex.length
    var prevSplitLineIndex = -1 // 矩阵第一条分割线索引为 -1
    var charData = [] // 单个字符矩阵数据的临时存储数组
    var charDataWidth // 单个字符的宽度
    var index
    var j, k
    for (j = 0; j < indexSize; j++) {
      index = splitLineIndex[j]
      charDataWidth = index - prevSplitLineIndex - 1

      if (charDataWidth > 0) {
        for (k = 0; k < height; k++) {
          for (i = prevSplitLineIndex + 1; i < index; i++) {
            charData.push(imageData[i + k * width])
          }
        }
      }

      if (charData.length) {
        result.push({
          width: charDataWidth,
          data: charData
        })
        charData = []
      }
      prevSplitLineIndex = index;
    }

    return result
  },

  cleanEdge: function(charData, width) {
    var l = charData.length;
    var result = []
    var i

    var topEdgeLineIndex, bottomEdgeLineIndex
    for (i = 0; i < l; i++) {
      if (charData[i] == this.VALID_PIXEL_FLAG) {
        topEdgeLineIndex = Math.floor(i / width)
        break
      }
    }

    for (i = l - 1; i >= 0; i--) {
      if (charData[i] == this.VALID_PIXEL_FLAG) {
        bottomEdgeLineIndex = Math.floor(i / width)
        break
      }
    }

    return charData.slice(topEdgeLineIndex * width, bottomEdgeLineIndex * width + width)
  },

  /**
   * 计算两个字符串的编辑长度（Levenshtein Distance）
   * calcLevenshteinDistance('kitten', 'sitting')
          s,i,t,t,i,n,g
        0,1,2,3,4,5,6,7   一次计算后的 v0
      k 1,1,2,3,4,5,6,7 - 1,1,2,3,4,5,6,7 
      i 2,2,1,2,3,4,5,6 - 2,2,1,2,3,4,5,6 
      t 3,3,2,1,2,3,4,5 - 3,3,2,1,2,3,4,5 
      t 4,4,3,2,1,2,3,4 - 4,4,3,2,1,2,3,4 
      e 5,5,4,3,2,2,3,4 - 5,5,4,3,2,2,3,4 
      n 6,6,5,4,3,3,2,3 - 6,6,5,4,3,3,2,3

      3
   */
  calcLevenshteinDistance: function(s, t) {
    var sLen = s.length
    var tLen = t.length

    // 向量（vector）用于存储临时计算数据
    var v0 = [] // v0 用于保存上一行数据
    var v1 = [] // v1 用于保存计算之中行的数据
    var i, j, sChar, tChar, cost

    if (s == t)
      return 0
    if (sLen == 0)
      return tLen
    if (tLen == 0)
      return sLen

    // 初始化矢量 v0
    for (j = 0; j <= tLen; v0.push(j), j++);

    // console.log('    ' + Array.prototype.join.call(t, ' '))
    // console.log('  ' + v0.join(' '))

    for (i = 1; i <= sLen; i++) {
      v1[0] = i
      sChar = s.charAt(i - 1)
      for (j = 1; j <= tLen; j++) {
        tChar = t.charAt(j - 1)
        if (sChar == tChar) {
          cost = 0
        } else {
          cost = 1
        }

        v1[j] = Math.min(v1[j - 1] + 1, v0[j] + 1, v0[j - 1] + cost)

        // 改变 v0
        v0[j - 1] = v1[j - 1]
      }

      // 改变 v0 使在一行循环完后 v0 和 v1 相同以便下次循环使用
      v0[tLen] = v1[tLen]

      // console.log(s[i - 1] + ' ' + v1.join(' ') + ' - ' + v0.join(' '))
    }

    return v1[tLen]
  },

  /**
   * 使用 Levenshtein Distance 算法计算两个字符串的相似性
   * @return {Number} 0 到 1 之间的表示相似度的五位小数
   */
  calcSimilarity: function(str1, str2) {
    var l = Math.max(str1.length, str2.length)
    var d = this.calcLevenshteinDistance(str1, str2)
    return (1 - d / l).toFixed(5)
  },

  match: function(charData) {
    charData = charData.join('')
    var models = this.charModels
    var model
    var l
    var similarity
    var maxSimilarity = 0
    var result = '?'

    // 先尝试精确匹配
    for (var val in models) {
      model = models[val]
      l = model.length
      for (var i = 0; i < l; i++) {
        if (model[i] == charData) {
          return val
        }
      }
    }

    for (var val in models) {
      model = models[val]
      l = model.length
      for (var i = 0; i < l; i++) {
        similarity = this.calcSimilarity(model[i], charData)
        if (similarity > maxSimilarity) {
          maxSimilarity = similarity
          result = val
        }
      }
    }

    return result
  },

  detect: function(imageData) {
    var self = this
    var convertedImageData = this.convertGrey(imageData)    
    var binarizatedImageData = this.binarizate(convertedImageData)
    var chars = this.splitChars(binarizatedImageData, imageData.width)
    var charData, cleanedCharData, value
    var result = []
    var l = chars.length

    for (var i = 0; i < l; i ++) {
      charData = chars[i]
      cleanedCharData = this.cleanEdge(charData.data, charData.width)
      value = this.match(cleanedCharData)
      result.push(value)
    }

    return result.join('')
  },

  study: function(imageData, value) {
    var self = this
    var convertedImageData = this.convertGrey(imageData)
    var binarizatedImageData = this.binarizate(convertedImageData)
    var chars = this.splitChars(binarizatedImageData, imageData.width)
    var result = {}

    chars.forEach(function(data, index) {
      result[value[index]] = self.cleanEdge(data.data, data.width).join('')
    });

    return result
  }
}

S.PriceDetector = PriceDetector

})(exports);

var EXPORTED_SYMBOLS = ["exports"];